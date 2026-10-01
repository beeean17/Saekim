import { create } from 'zustand';
import { detectLineEndings, serializeLineEndings } from '../core/document/lineEndings';
import { requestExternalChangeDecision } from '../core/document/externalChangeDecision';
import { Backend } from '../platform/common/backend';
import { currentPlatformCapabilities } from '../platform/common/capabilities';
import type { WorkspaceSession } from '../types/session';
import type { DocumentSnapshot } from '../types/metadata';
import type { FileRevision, FileTreeNode, OpenFile, OpenFilePayload, RecentWorkspace, TextEncoding } from '../types/workspace';
import { translateCurrent } from '../i18n/current';
import { notifyError } from '../core/notifications';
import { requestConfirmation } from '../core/dialogs/confirm';
import {
  canRedoEdit,
  canUndoEdit,
  classifyEdit,
  forgetEditHistory,
  recordEdit,
  redoEdit,
  renameEditHistory,
  resetEditHistory,
  undoEdit,
  type EditSnapshot,
} from '../core/editor/editHistory';
import {
  compareTreeNodes,
  fileNameFromPath,
  findTreeNode,
  folderChildrenAreLoaded,
  isPlaceholderPath,
  isWorkspaceEntryPath,
  mapWorkspaceEntryPath,
  mergeTreeNodes,
  nextWorkspaceFileName,
  nextWorkspaceFolderName,
  removeTreeEntry,
  renameTreeEntryPaths,
  updateTreeFolder,
} from './workspaceTree';

const confirmedEncodingChanges = new Set<string>();
let pendingFileCreationSequence = 0;

export interface PendingFileCreation {
  id: number;
  parentPath: string;
  name: string;
}

export interface PendingFolderCreation {
  id: number;
  parentPath: string;
  name: string;
}

interface UndoableFileCreation {
  path: string;
  rootPath: string;
}

interface WorkspaceState {
  rootPath: string | null;
  tree: FileTreeNode[];
  openFiles: OpenFile[];
  recentWorkspaces: RecentWorkspace[];
  activeFileId: string | null;
  closedFiles: OpenFile[];
  selectedFolderPath: string | null;
  pendingFileCreation: PendingFileCreation | null;
  pendingFolderCreation: PendingFolderCreation | null;
  lastCreatedFile: UndoableFileCreation | null;
  history: { back: string[]; forward: string[]; current: string | null };
  openFolder: () => Promise<void>;
  openWorkspace: (path: string) => Promise<void>;
  openFile: (path?: string) => Promise<void>;
  createFile: (parentPath?: string) => Promise<void>;
  createFolder: (parentPath?: string) => Promise<void>;
  commitFileCreation: (name: string) => Promise<string | null>;
  cancelFileCreation: () => void;
  cancelFolderCreation: () => void;
  canUndoFileCreation: () => boolean;
  undoFileCreation: () => Promise<boolean>;
  selectFolder: (path: string) => void;
  toggleFolder: (path: string) => Promise<void>;
  setActiveFile: (id: string) => void;
  closeFile: (id: string) => void;
  reopenClosedFile: () => Promise<void>;
  updateContent: (id: string, text: string, selection?: { start: number; end: number }) => void;
  setEncoding: (id: string, encoding: TextEncoding) => void;
  restoreDocumentSnapshot: (id: string, snapshot: DocumentSnapshot) => void;
  canUndoEdit: () => boolean;
  canRedoEdit: () => boolean;
  undoEdit: () => EditSnapshot | null;
  redoEdit: () => EditSnapshot | null;
  saveFile: (id: string) => Promise<string | null>;
  saveActive: () => Promise<void>;
  saveActiveAs: () => Promise<void>;
  renameWorkspaceEntry: (previousPath: string, nextPath: string) => void;
  removeWorkspaceEntry: (path: string, openFileIds?: readonly string[]) => void;
  refresh: () => Promise<void>;
  refreshFolder: (path: string) => Promise<void>;
  historyPrev: () => Promise<void>;
  historyNext: () => Promise<void>;
  restoreWorkspace: (workspace: WorkspaceSession) => void;
  restoreRecentWorkspaces: (workspaces: RecentWorkspace[] | undefined) => void;
  openFileFromPayload: (opened: OpenFilePayload) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rootPath: null,
  tree: [],
  openFiles: [],
  recentWorkspaces: [],
  activeFileId: null,
  closedFiles: [],
  selectedFolderPath: null,
  pendingFileCreation: null,
  pendingFolderCreation: null,
  lastCreatedFile: null,
  history: { back: [], forward: [], current: null },
  openFolder: async () => {
    try {
      const rootPath = await Backend.folders.openFolderDialog();
      if (!rootPath) return;
      await get().openWorkspace(rootPath);
    } catch (error) {
      console.error('폴더 열기 실패:', error);
      notifyError(translateCurrent('workspace.openFolderFailed'), error);
    }
  },
  openWorkspace: async (path) => {
    if (!path) return;
    if (!(await confirmDiscardDirtyWorkspace(get().openFiles))) return;

    try {
      const savedWorkspace = await Backend.metadata.loadWorkspaceSession(path);
      if (savedWorkspace) {
        let workspace = savedWorkspace;
        if (workspace.rootPath && !isPlaceholderPath(workspace.rootPath)) {
          const folder = await Backend.folders.readFolder(workspace.rootPath);
          workspace = { ...workspace, rootPath: folder.rootPath, tree: folder.tree };
        }
        set((state) => workspaceSessionPatch(state, workspace));
        return;
      }

      const folder = await Backend.folders.readFolder(path);
      set((state) => workspaceFolderPatch(state, folder.rootPath, folder.tree));
    } catch (error) {
      console.error('워크스페이스 열기 실패:', error);
      notifyError(translateCurrent('workspace.openFolderFailed'), error);
    }
  },
  openFile: async (path) => {
    if (!path) {
      try {
        const opened = await Backend.files.openFileDialog();
        if (opened) {
          await get().openFileFromPayload(opened);
        }
      } catch (error) {
        console.error('파일 열기 실패:', error);
        notifyError(translateCurrent('workspace.openFileFailed'), error);
      }
      return;
    }

    const existing = get().openFiles.find((file) => file.path === path);
    if (existing) {
      set((state) => ({
        ...activateOpenFile(state, existing),
        lastCreatedFile: state.lastCreatedFile?.path === existing.path ? state.lastCreatedFile : null,
      }));
      const folderPatch = await workspaceFolderPatchForOpenFile(existing, get().rootPath);
      if (folderPatch && get().activeFileId === existing.id) set((state) => applyFolderPatch(state, folderPatch));
      return;
    }

    try {
      const opened = await Backend.files.readFile(path);
      await get().openFileFromPayload(opened);
    } catch (error) {
      console.error('파일 읽기 실패:', error);
      notifyError(translateCurrent('workspace.openFileFailed'), error);
    }
  },
  openFileFromPayload: async (opened) => {
    const file = toOpenFile(opened.path, opened.name, opened.content, opened.encoding, opened.displayPath ?? undefined, opened.revision);
    resetEditHistory(file.id, { content: file.content, selectionStart: 0, selectionEnd: 0 });
    set((state) => ({
      ...upsertOpenFile(state, file),
      lastCreatedFile: state.lastCreatedFile?.path === file.path ? state.lastCreatedFile : null,
    }));
    const folderPatch = await workspaceFolderPatchForOpenFile(file, get().rootPath);
    if (folderPatch && get().activeFileId === file.id) set((state) => applyFolderPatch(state, folderPatch));
  },
  createFile: async (requestedParentPath) => {
    const state = get();
    if (
      state.rootPath &&
      !isPlaceholderPath(state.rootPath) &&
      currentPlatformCapabilities().has('folder.operations')
    ) {
      if (state.pendingFileCreation) return;
      const parentPath = workspaceFolderForCreation(state, requestedParentPath);
      let children = workspaceFolderChildren(state, parentPath);
      if (parentPath !== state.rootPath && !folderChildrenAreLoaded(state.tree, parentPath)) {
        try {
          children = await Backend.folders.readFolderChildren(parentPath);
        } catch (error) {
          console.error('새 파일을 만들 폴더를 불러오지 못했습니다:', error);
        }
      }
      set({
        tree: parentPath === state.rootPath
          ? state.tree
          : updateTreeFolder(state.tree, parentPath, {
              children,
              isOpen: true,
              isLoaded: true,
            }),
        selectedFolderPath: parentPath,
        pendingFileCreation: {
          id: ++pendingFileCreationSequence,
          parentPath,
          name: nextWorkspaceFileName(children),
        },
        pendingFolderCreation: null,
        lastCreatedFile: null,
      });
      return;
    }

    const untitledNumber = nextUntitledNumber(get().openFiles);
    const file = toOpenFile(`~untitled-${untitledNumber}`, `untitled-${untitledNumber}.md`, '');
    set((current) => ({ ...upsertOpenFile(current, file), lastCreatedFile: null }));
  },
  createFolder: async (requestedParentPath) => {
    const state = get();
    if (
      !state.rootPath
      || isPlaceholderPath(state.rootPath)
      || !currentPlatformCapabilities().has('folder.operations')
      || state.pendingFolderCreation
    ) return;

    const parentPath = workspaceFolderForCreation(state, requestedParentPath);
    let children = workspaceFolderChildren(state, parentPath);
    if (parentPath !== state.rootPath && !folderChildrenAreLoaded(state.tree, parentPath)) {
      try {
        children = await Backend.folders.readFolderChildren(parentPath);
      } catch (error) {
        console.error('새 폴더를 만들 위치를 불러오지 못했습니다:', error);
      }
    }
    set({
      selectedFolderPath: parentPath,
      pendingFileCreation: null,
      pendingFolderCreation: {
        id: ++pendingFileCreationSequence,
        parentPath,
        name: nextWorkspaceFolderName(children),
      },
      lastCreatedFile: null,
    });
  },
  commitFileCreation: async (name) => {
    const pending = get().pendingFileCreation;
    if (!pending) return null;
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error(translateCurrent('sidebar.fileNameRequired'));

    const opened = await Backend.folders.createFile(pending.parentPath, normalizedName);
    const file = toOpenFile(
      opened.path,
      opened.name,
      opened.content,
      opened.encoding,
      opened.displayPath ?? undefined,
      opened.revision,
    );
    let refreshedChildren: FileTreeNode[] | null = null;
    try {
      refreshedChildren = await Backend.folders.readFolderChildren(pending.parentPath);
    } catch (error) {
      console.error('새 파일 생성 후 탐색기 새로고침 실패:', error);
    }

    set((state) => {
      if (state.pendingFileCreation?.id !== pending.id) return {};
      return {
        ...upsertOpenFile(state, file),
        tree: refreshedChildren
          ? replaceWorkspaceFolderChildren(state, pending.parentPath, refreshedChildren)
          : insertFileNodeUnderFolder(state, pending.parentPath, file),
        selectedFolderPath: pending.parentPath,
        pendingFileCreation: null,
        lastCreatedFile: { path: file.path, rootPath: state.rootPath ?? pending.parentPath },
      };
    });
    return file.path;
  },
  cancelFileCreation: () => set({ pendingFileCreation: null }),
  cancelFolderCreation: () => set({ pendingFolderCreation: null }),
  canUndoFileCreation: () => canUndoFileCreation(get()),
  undoFileCreation: async () => {
    const state = get();
    const creation = state.lastCreatedFile;
    if (!creation || !canUndoFileCreation(state)) return false;

    try {
      await Backend.folders.trashEntry(creation.path);
      get().removeWorkspaceEntry(creation.path, [creation.path]);
      set({ lastCreatedFile: null });
      if (get().rootPath === creation.rootPath) await get().refresh();
      return true;
    } catch (error) {
      console.error('새 파일 생성 실행 취소 실패:', error);
      notifyError(translateCurrent('sidebar.fileActionFailed', { message: errorMessage(error) }), error);
      return false;
    }
  },
  selectFolder: (path) => {
    const state = get();
    if (isWorkspaceFolderPath(state, path)) set({ selectedFolderPath: path });
  },
  toggleFolder: async (path) => {
    const node = findTreeNode(get().tree, path);
    if (!node || node.type !== 'folder') return;

    set({ selectedFolderPath: path });

    if (!node.isOpen && !node.isLoaded && !isPlaceholderPath(path)) {
      try {
        const children = await Backend.folders.readFolderChildren(path);
        set((state) => ({
          tree: updateTreeFolder(state.tree, path, { children, isLoaded: true, isOpen: true }),
        }));
      } catch (error) {
        console.error('하위 폴더 읽기 실패:', error);
      }
      return;
    }

    set((state) => ({
      tree: updateTreeFolder(state.tree, path, { isOpen: !node.isOpen }),
    }));
  },
  setActiveFile: (id) => {
    const file = get().openFiles.find((candidate) => candidate.id === id);
    if (!file) return;

    set((state) => ({
      ...activateOpenFile(state, file),
      lastCreatedFile: state.lastCreatedFile?.path === file.path ? state.lastCreatedFile : null,
    }));
  },
  closeFile: (id) => {
    confirmedEncodingChanges.delete(id);
    forgetEditHistory(id);
    set((state) => {
      const closedIndex = state.openFiles.findIndex((file) => file.id === id);
      const closedFile = state.openFiles[closedIndex];
      const openFiles = state.openFiles.filter((file) => file.id !== id);
      const nextActiveFile =
        state.activeFileId === id ? openFiles[Math.max(0, Math.min(closedIndex, openFiles.length - 1))] ?? null : null;
      const activeFileId = nextActiveFile?.id ?? (state.activeFileId === id ? null : state.activeFileId);
      const closedPath = closedFile?.path;
      const closedSnapshot = closedFile
        ? {
            ...closedFile,
            content: closedFile.savedContent,
            encoding: closedFile.savedEncoding,
          }
        : null;
      const closedFiles = closedSnapshot
        ? [closedSnapshot, ...state.closedFiles.filter((file) => file.path !== closedSnapshot.path)].slice(0, 20)
        : state.closedFiles;
      const nextActivePath = nextActiveFile?.path ?? null;

      if (state.activeFileId !== id) {
        return {
          openFiles,
          activeFileId,
          closedFiles,
          history: state.history,
          lastCreatedFile: state.lastCreatedFile?.path === closedPath ? null : state.lastCreatedFile,
        };
      }

      const back = nextActivePath === state.history.back[state.history.back.length - 1]
        ? state.history.back.slice(0, -1)
        : state.history.back;
      const forward = closedPath
        ? [closedPath, ...state.history.forward.filter((path) => path !== closedPath)]
        : state.history.forward;

      return {
        openFiles,
        activeFileId,
        closedFiles,
        lastCreatedFile: state.lastCreatedFile?.path === closedPath ? null : state.lastCreatedFile,
        history: {
          back,
          forward,
          current: nextActivePath,
        },
      };
    });
  },
  reopenClosedFile: async () => {
    const closedFile = get().closedFiles[0];
    if (!closedFile) return;
    set((state) => ({ closedFiles: state.closedFiles.slice(1) }));

    if (isPlaceholderPath(closedFile.path)) {
      set((state) => upsertOpenFile(state, closedFile));
      return;
    }

    try {
      const opened = await Backend.files.readFile(closedFile.path);
      await get().openFileFromPayload(opened);
    } catch (error) {
      console.error('닫은 탭 다시 열기 실패:', error);
      set((state) => ({
        closedFiles: [closedFile, ...state.closedFiles.filter((file) => file.path !== closedFile.path)].slice(0, 20),
      }));
    }
  },
  updateContent: (id, text, selection) => {
    const previous = get().openFiles.find((file) => file.id === id);
    if (previous && previous.content !== text) {
      /* Every content change goes through here, so this is the one place that
         can keep an undo stack the browser cannot destroy. Keystrokes coalesce;
         anything larger (paste, replace all, snippet insert) is its own step. */
      const caret = selection ?? caretAfterChange(previous.content, text);
      recordEdit(
        id,
        { content: text, selectionStart: caret.start, selectionEnd: caret.end },
        selection ? classifyEdit(previous.content, text) : 'commit',
      );
    }
    set((state) => ({
      openFiles: state.openFiles.map((file) => (file.id === id ? { ...file, content: text } : file)),
    }));
  },
  canUndoEdit: () => canUndoEdit(get().activeFileId),
  canRedoEdit: () => canRedoEdit(get().activeFileId),
  undoEdit: () => {
    const id = get().activeFileId;
    if (!id) return null;
    const snapshot = undoEdit(id);
    if (snapshot) applyEditSnapshot(set, id, snapshot);
    return snapshot;
  },
  redoEdit: () => {
    const id = get().activeFileId;
    if (!id) return null;
    const snapshot = redoEdit(id);
    if (snapshot) applyEditSnapshot(set, id, snapshot);
    return snapshot;
  },
  setEncoding: (id, encoding) => {
    confirmedEncodingChanges.delete(id);
    set((state) => ({
      openFiles: state.openFiles.map((file) => (file.id === id ? { ...file, encoding } : file)),
    }));
  },
  restoreDocumentSnapshot: (id, snapshot) => {
    confirmedEncodingChanges.delete(id);
    /* Restoring an old version is undoable like any other edit, so a mistaken
       restore no longer costs the user their in-progress text. */
    recordEdit(id, { content: snapshot.content, selectionStart: 0, selectionEnd: 0 }, 'commit');
    set((state) => ({
      openFiles: state.openFiles.map((file) =>
        file.id === id
          ? { ...file, content: snapshot.content, encoding: snapshot.encoding, eol: snapshot.eol }
          : file,
      ),
    }));
  },
  saveFile: async (id) => {
    const file = get().openFiles.find((candidate) => candidate.id === id);
    if (!file) return null;
    if (!(await confirmEncodingChange(file))) return null;
    let result = await Backend.files.saveFile(
      file.path.startsWith('~') ? null : file.path,
      serializeLineEndings(file.content, file.eol),
      file.encoding,
      { expectedRevision: file.diskRevision },
    );
    if (result.status === 'conflict') {
      const decision = await requestExternalChangeDecision(file.name);
      if (decision === 'cancel') return null;
      if (decision === 'reload') {
        let opened: OpenFilePayload;
        try {
          opened = await Backend.files.readFile(file.path);
        } catch (error) {
          console.error('외부 변경 파일 다시 불러오기 실패:', error);
          notifyError(translateCurrent('document.reloadFailed', { name: file.name }), error);
          return null;
        }
        const reloaded = toOpenFile(
          opened.path,
          opened.name,
          opened.content,
          opened.encoding,
          opened.displayPath ?? undefined,
          opened.revision,
        );
        set((state) => ({
          openFiles: state.openFiles.map((candidate) => (candidate.id === file.id ? reloaded : candidate)),
          lastCreatedFile: state.lastCreatedFile?.path === file.path ? null : state.lastCreatedFile,
        }));
        await deleteDocumentDraftSafely(file.path);
        return reloaded.path;
      }
      result = decision === 'save-as'
        ? await Backend.files.saveFileAs(serializeLineEndings(file.content, file.eol), file.name, file.encoding)
        : await Backend.files.saveFile(
            file.path,
            serializeLineEndings(file.content, file.eol),
            file.encoding,
            { expectedRevision: file.diskRevision, force: true },
          );
    }
    if (result.status !== 'saved') return null;
    const savedPath = result.path;
    confirmedEncodingChanges.delete(file.id);
    const savedFile = { path: savedPath, name: fileNameFromPath(savedPath) };
    set((current) => ({
      ...savedOpenFilePatch(current, file, savedPath, savedFile.name, result.revision),
      lastCreatedFile:
        current.lastCreatedFile?.path === file.path && (file.content !== '' || savedPath !== file.path)
          ? null
          : current.lastCreatedFile,
    }));
    await deleteDocumentDraftSafely(file.path);
    const folderPatch = await workspaceFolderPatchForOpenFile(
      { ...file, id: savedPath, path: savedPath, displayPath: savedPath, name: savedFile.name },
      get().rootPath,
    );
    if (folderPatch) set((state) => applyFolderPatch(state, folderPatch));
    return savedPath;
  },
  saveActive: async () => {
    const { activeFileId, saveFile } = get();
    if (activeFileId) await saveFile(activeFileId);
  },
  saveActiveAs: async () => {
    const state = get();
    const file = state.openFiles.find((candidate) => candidate.id === state.activeFileId);
    if (!file) return;
    if (!(await confirmEncodingChange(file))) return;
    const result = await Backend.files.saveFileAs(
      serializeLineEndings(file.content, file.eol),
      file.name,
      file.encoding,
    );
    if (result.status !== 'saved') return;
    const savedPath = result.path;
    confirmedEncodingChanges.delete(file.id);
    const savedFile = { path: savedPath, name: fileNameFromPath(savedPath) };
    set((current) => ({
      ...savedOpenFilePatch(current, file, savedPath, savedFile.name, result.revision),
      lastCreatedFile: current.lastCreatedFile?.path === file.path ? null : current.lastCreatedFile,
    }));
    await deleteDocumentDraftSafely(file.path);
    const folderPatch = await workspaceFolderPatchForOpenFile(
      { ...file, id: savedPath, path: savedPath, displayPath: savedPath, name: savedFile.name },
      get().rootPath,
    );
    if (folderPatch) set((state) => applyFolderPatch(state, folderPatch));
  },
  renameWorkspaceEntry: (previousPath, nextPath) => {
    set((state) => ({
      tree: renameTreeEntryPaths(state.tree, previousPath, nextPath),
      openFiles: state.openFiles.map((file) => renameOpenFilePath(file, previousPath, nextPath)),
      activeFileId: state.activeFileId ? mapWorkspaceEntryPath(state.activeFileId, previousPath, nextPath) : null,
      closedFiles: state.closedFiles.map((file) => renameOpenFilePath(file, previousPath, nextPath)),
      history: {
        back: state.history.back.map((path) => mapWorkspaceEntryPath(path, previousPath, nextPath)),
        forward: state.history.forward.map((path) => mapWorkspaceEntryPath(path, previousPath, nextPath)),
        current: state.history.current
          ? mapWorkspaceEntryPath(state.history.current, previousPath, nextPath)
          : null,
      },
      selectedFolderPath: state.selectedFolderPath
        ? mapWorkspaceEntryPath(state.selectedFolderPath, previousPath, nextPath)
        : null,
      lastCreatedFile: null,
    }));
  },
  removeWorkspaceEntry: (path, openFileIds = []) => {
    set((state) => {
      const removedIds = new Set(openFileIds);
      const isRemovedFile = (file: OpenFile) =>
        removedIds.has(file.id) || isWorkspaceEntryPath(file.path, path);
      const removedActiveIndex = state.openFiles.findIndex((file) => file.id === state.activeFileId);
      const openFiles = state.openFiles.filter((file) => !isRemovedFile(file));
      const activeRemoved = state.activeFileId
        ? removedIds.has(state.activeFileId)
          || state.openFiles.some((file) => file.id === state.activeFileId && isRemovedFile(file))
        : false;
      const activeFileId = activeRemoved
        ? openFiles[Math.max(0, Math.min(removedActiveIndex, openFiles.length - 1))]?.id ?? null
        : state.activeFileId;
      const activeFile = openFiles.find((file) => file.id === activeFileId) ?? null;
      return {
        tree: removeTreeEntry(state.tree, path),
        openFiles,
        activeFileId,
        closedFiles: state.closedFiles.filter((file) => !isRemovedFile(file)),
        selectedFolderPath:
          state.selectedFolderPath && isWorkspaceEntryPath(state.selectedFolderPath, path)
            ? state.rootPath
            : state.selectedFolderPath,
        pendingFileCreation:
          state.pendingFileCreation && isWorkspaceEntryPath(state.pendingFileCreation.parentPath, path)
            ? null
            : state.pendingFileCreation,
        pendingFolderCreation:
          state.pendingFolderCreation && isWorkspaceEntryPath(state.pendingFolderCreation.parentPath, path)
            ? null
            : state.pendingFolderCreation,
        lastCreatedFile: state.lastCreatedFile && isWorkspaceEntryPath(state.lastCreatedFile.path, path)
          ? null
          : state.lastCreatedFile,
        history: {
          back: state.history.back.filter((candidate) => !isWorkspaceEntryPath(candidate, path)),
          forward: state.history.forward.filter((candidate) => !isWorkspaceEntryPath(candidate, path)),
          current: activeFile?.path ?? null,
        },
      };
    });
  },
  refresh: async () => {
    const { rootPath } = get();
    if (!rootPath || isPlaceholderPath(rootPath)) return;

    try {
      const folder = await Backend.folders.readFolder(rootPath);
      set((state) => {
        const tree = mergeTreeNodes(folder.tree, state.tree);
        return {
          rootPath: folder.rootPath,
          tree,
          selectedFolderPath: isWorkspaceFolderPath({ ...state, rootPath: folder.rootPath, tree }, state.selectedFolderPath)
            ? state.selectedFolderPath
            : folder.rootPath,
        };
      });
    } catch (error) {
      console.error('폴더 새로고침 실패:', error);
    }
  },
  refreshFolder: async (path) => {
    const state = get();
    if (!isWorkspaceFolderPath(state, path) || isPlaceholderPath(path)) return;

    try {
      const children = await Backend.folders.readFolderChildren(path);
      set((current) => ({
        tree: replaceWorkspaceFolderChildren(current, path, children),
      }));
    } catch (error) {
      console.error('폴더 새로고침 실패:', error);
    }
  },
  historyPrev: async () => {
    await navigateHistory('back', get, set);
  },
  historyNext: async () => {
    await navigateHistory('forward', get, set);
  },
  restoreWorkspace: (workspace) => {
    const normalizedWorkspace = normalizeRestoredWorkspace(workspace);
    const restoredRootPath = normalizedWorkspace.rootPath;
    const openFiles = normalizedWorkspace.openFiles;
    seedEditHistories(openFiles);
    const activeFileId =
      normalizedWorkspace.activeFileId && openFiles.some((file) => file.id === normalizedWorkspace.activeFileId)
        ? normalizedWorkspace.activeFileId
        : openFiles[0]?.id ?? null;
    const activeFile = openFiles.find((file) => file.id === activeFileId) ?? null;
    set({
      rootPath: normalizedWorkspace.rootPath,
      tree: normalizedWorkspace.tree,
      openFiles,
      activeFileId,
      closedFiles: [],
      selectedFolderPath: normalizedWorkspace.rootPath,
      pendingFileCreation: null,
      pendingFolderCreation: null,
      lastCreatedFile: null,
      recentWorkspaces: normalizedWorkspace.rootPath
        ? upsertRecentWorkspace(get().recentWorkspaces, normalizedWorkspace.rootPath)
        : get().recentWorkspaces,
      history: { back: [], forward: [], current: activeFile?.path ?? null },
    });

    if (restoredRootPath && !isPlaceholderPath(restoredRootPath)) {
      void Backend.folders
        .readFolder(restoredRootPath)
        .then((folder) => {
          if (get().rootPath === restoredRootPath) {
            set((state) => ({
              rootPath: folder.rootPath,
              tree: mergeTreeNodes(folder.tree, state.tree),
              selectedFolderPath: state.selectedFolderPath ?? folder.rootPath,
            }));
          }
        })
        .catch((error) => console.error('복원한 워크스페이스 경로 동기화 실패:', error));
    }
  },
  restoreRecentWorkspaces: (workspaces) => {
    set((state) => ({
      recentWorkspaces: normalizeRecentWorkspaces(workspaces, state.rootPath),
    }));
  },
}));

export function selectActiveFile(state: WorkspaceState): OpenFile | null {
  return state.openFiles.find((file) => file.id === state.activeFileId) ?? null;
}

export function isDirty(file: OpenFile | null): boolean {
  return Boolean(file && (file.content !== file.savedContent || file.encoding !== file.savedEncoding));
}

type HistoryDirection = 'back' | 'forward';

async function navigateHistory(
  direction: HistoryDirection,
  get: () => WorkspaceState,
  set: (updater: (state: WorkspaceState) => Partial<WorkspaceState>) => void,
): Promise<void> {
  const history = get().history;
  const targetPath = direction === 'back' ? history.back[history.back.length - 1] : history.forward[0];
  if (!targetPath) return;

  let file = get().openFiles.find((candidate) => candidate.path === targetPath);
  if (!file) {
    try {
      const opened = await Backend.files.readFile(targetPath);
      file = toOpenFile(opened.path, opened.name, opened.content, opened.encoding, opened.displayPath ?? undefined, opened.revision);
    } catch (error) {
      console.error('히스토리 파일 다시 열기 실패:', error);
      return;
    }
  }

  set((state) => {
    const latestTargetPath = direction === 'back'
      ? state.history.back[state.history.back.length - 1]
      : state.history.forward[0];
    if (latestTargetPath !== targetPath) return {};

    const latestFile = state.openFiles.find((candidate) => candidate.path === targetPath) ?? file;
    return {
      ...navigateToHistoryFile(state, latestFile, direction),
      lastCreatedFile: state.lastCreatedFile?.path === latestFile.path ? state.lastCreatedFile : null,
    };
  });
}

function navigateToHistoryFile(
  state: WorkspaceState,
  file: OpenFile,
  direction: HistoryDirection,
): Pick<WorkspaceState, 'openFiles' | 'activeFileId' | 'history'> {
  const existing = state.openFiles.some((candidate) => candidate.id === file.id);
  const openFiles = existing
    ? state.openFiles
    : [...state.openFiles, file];

  if (direction === 'back') {
    return {
      openFiles,
      activeFileId: file.id,
      history: {
        back: state.history.back.slice(0, -1),
        forward: state.history.current ? [state.history.current, ...state.history.forward] : state.history.forward,
        current: file.path,
      },
    };
  }

  return {
    openFiles,
    activeFileId: file.id,
    history: {
      back: state.history.current ? [...state.history.back, state.history.current] : state.history.back,
      forward: state.history.forward.slice(1),
      current: file.path,
    },
  };
}

function toOpenFile(
  path: string,
  name: string,
  content: string,
  encoding: TextEncoding = 'utf-8',
  displayPath?: string,
  diskRevision?: FileRevision,
): OpenFile {
  const lineEndings = detectLineEndings(content);
  return {
    id: path,
    path,
    displayPath: displayPath ?? readablePathFromRawPath(path, name),
    name,
    content,
    savedContent: content,
    encoding,
    savedEncoding: encoding,
    eol: lineEndings.eol,
    hasMixedEol: lineEndings.mixed,
    diskRevision,
  };
}

function readablePathFromRawPath(path: string, name: string): string {
  if (path.startsWith('content://')) {
    return `${contentAuthorityLabel(path)} / ${name}`;
  }
  return path;
}

function contentAuthorityLabel(path: string): string {
  try {
    const url = new URL(path);
    if (url.hostname === 'com.android.providers.downloads.documents') return 'Downloads';
    if (url.hostname === 'com.android.externalstorage.documents') return 'Storage';
    if (url.hostname === 'com.android.providers.media.documents') return 'Media';
    return url.hostname || 'Android document';
  } catch {
    return 'Android document';
  }
}

function toRecentWorkspace(path: string, openedAt = Date.now()): RecentWorkspace {
  return {
    id: workspaceIdFromPath(path),
    path,
    name: workspaceDisplayName(path),
    openedAt,
  };
}

function nextUntitledNumber(openFiles: readonly OpenFile[]): number {
  const used = new Set(
    openFiles.flatMap((file) => {
      const match = /^~untitled-(\d+)$/.exec(file.path);
      return match ? [Number(match[1])] : [];
    }),
  );
  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

function workspaceFolderForCreation(state: WorkspaceState, requestedParentPath?: string): string {
  if (requestedParentPath && isWorkspaceFolderPath(state, requestedParentPath)) return requestedParentPath;
  if (state.selectedFolderPath && isWorkspaceFolderPath(state, state.selectedFolderPath)) return state.selectedFolderPath;
  return state.rootPath ?? '';
}

function workspaceFolderChildren(state: WorkspaceState, parentPath: string): FileTreeNode[] {
  if (parentPath === state.rootPath) return state.tree;
  const folder = findTreeNode(state.tree, parentPath);
  return folder?.type === 'folder' ? folder.children ?? [] : [];
}

function isWorkspaceFolderPath(state: WorkspaceState, path: string | null): path is string {
  if (!path || !state.rootPath) return false;
  if (path === state.rootPath) return true;
  const node = findTreeNode(state.tree, path);
  return node?.type === 'folder';
}

function replaceWorkspaceFolderChildren(
  state: WorkspaceState,
  parentPath: string,
  children: FileTreeNode[],
): FileTreeNode[] {
  if (parentPath === state.rootPath) return mergeTreeNodes(children, state.tree);
  const previousChildren = workspaceFolderChildren(state, parentPath);
  return updateTreeFolder(state.tree, parentPath, {
    children: mergeTreeNodes(children, previousChildren),
    isLoaded: true,
    isOpen: true,
  });
}

function insertFileNodeUnderFolder(state: WorkspaceState, parentPath: string, file: OpenFile): FileTreeNode[] {
  const node: FileTreeNode = {
    id: file.path,
    name: file.name,
    path: file.path,
    type: 'file',
    modifiedAt: file.diskRevision?.modifiedAt,
  };
  const children = workspaceFolderChildren(state, parentPath);
  const nextChildren = [...children.filter((candidate) => candidate.path !== file.path), node].sort(compareTreeNodes);
  if (parentPath === state.rootPath) return nextChildren;
  return updateTreeFolder(state.tree, parentPath, { children: nextChildren, isLoaded: true, isOpen: true });
}

function canUndoFileCreation(state: WorkspaceState): boolean {
  const creation = state.lastCreatedFile;
  if (!creation || state.activeFileId !== creation.path) return false;
  const file = state.openFiles.find((candidate) => candidate.path === creation.path);
  return Boolean(file && file.content === '' && file.savedContent === '' && !isDirty(file));
}

function replaceHistoryPath(
  history: WorkspaceState['history'],
  previousPath: string,
  nextPath: string,
): WorkspaceState['history'] {
  const replace = (path: string) => (path === previousPath ? nextPath : path);
  return {
    back: history.back.map(replace),
    forward: history.forward.map(replace),
    current: history.current ? replace(history.current) : null,
  };
}

function savedOpenFilePatch(
  state: WorkspaceState,
  savedFile: OpenFile,
  savedPath: string,
  savedName: string,
  diskRevision?: FileRevision,
): Pick<WorkspaceState, 'openFiles' | 'activeFileId' | 'closedFiles' | 'history'> {
  /* Save As changes the document id; carry the undo stack across so the user
     does not silently lose their history by saving. */
  renameEditHistory(savedFile.id, savedPath);
  const openFiles = state.openFiles.flatMap((candidate) => {
    if (candidate.id === savedFile.id) {
      return [{
        ...candidate,
        id: savedPath,
        path: savedPath,
        displayPath: savedPath,
        name: savedName,
        savedContent: savedFile.content,
        savedEncoding: savedFile.encoding,
        hasMixedEol: false,
        diskRevision,
      }];
    }
    return candidate.id === savedPath || candidate.path === savedPath ? [] : [candidate];
  });

  return {
    openFiles,
    activeFileId: state.activeFileId === savedFile.id || state.activeFileId === savedPath
      ? savedPath
      : state.activeFileId,
    closedFiles: state.closedFiles.filter((candidate) => candidate.path !== savedPath),
    history: replaceHistoryPath(state.history, savedFile.path, savedPath),
  };
}

async function deleteDocumentDraftSafely(filePath: string): Promise<void> {
  try {
    await Backend.metadata.deleteDocumentDraft(filePath);
  } catch (error) {
    console.error('임시 문서 정리 실패:', error);
  }
}

function renameOpenFilePath(file: OpenFile, previousPath: string, nextPath: string): OpenFile {
  const path = mapWorkspaceEntryPath(file.path, previousPath, nextPath);
  if (path === file.path) return file;
  return {
    ...file,
    id: path,
    path,
    displayPath: path,
    name: fileNameFromPath(path),
  };
}

async function workspaceFolderPatchForFile(path: string): Promise<Pick<WorkspaceState, 'rootPath' | 'tree'> | null> {
  const folderPath = parentFolderFromFilePath(path);
  if (!folderPath) return null;

  try {
    const folder = await Backend.folders.readFolder(folderPath);
    return { rootPath: folder.rootPath, tree: folder.tree };
  } catch (error) {
    console.error('워크스페이스 경로 동기화 실패:', error);
    return null;
  }
}

async function workspaceFolderPatchForOpenFile(
  file: OpenFile,
  currentRootPath: string | null,
): Promise<Pick<WorkspaceState, 'rootPath' | 'tree'> | null> {
  if (shouldRetainWorkspaceRootForFile(currentRootPath, file.path)) return null;

  const folderPatch = await workspaceFolderPatchForFile(file.path);
  return folderPatch ?? androidContentWorkspacePatch(file);
}

function androidContentWorkspacePatch(file: OpenFile): Pick<WorkspaceState, 'rootPath' | 'tree'> | null {
  if (!file.path.startsWith('content://')) return null;

  return {
    rootPath: androidContentWorkspaceRoot(file),
    tree: [
      {
        id: file.path,
        name: file.name,
        type: 'file',
        path: file.path,
      },
    ],
  };
}

function androidContentWorkspaceRoot(file: OpenFile): string {
  const displayPath = file.displayPath ?? readablePathFromRawPath(file.path, file.name);
  const parts = displayPath.split('/').map((part) => part.trim()).filter(Boolean);
  const label = parts.length > 1 ? parts.slice(0, -1).join(' / ') : contentAuthorityLabel(file.path);
  return `~android/${label || 'Android document'}`;
}

function applyFolderPatch(
  state: WorkspaceState,
  patch: Pick<WorkspaceState, 'rootPath' | 'tree'>,
): Pick<WorkspaceState, 'rootPath' | 'tree' | 'recentWorkspaces' | 'selectedFolderPath' | 'pendingFileCreation' | 'pendingFolderCreation' | 'lastCreatedFile'> {
  return {
    ...patch,
    selectedFolderPath: patch.rootPath,
    pendingFileCreation: null,
    pendingFolderCreation: null,
    lastCreatedFile: null,
    recentWorkspaces: patch.rootPath ? upsertRecentWorkspace(state.recentWorkspaces, patch.rootPath) : state.recentWorkspaces,
  };
}

function workspaceFolderPatch(
  state: WorkspaceState,
  rootPath: string,
  tree: FileTreeNode[],
): Pick<WorkspaceState, 'rootPath' | 'tree' | 'openFiles' | 'activeFileId' | 'closedFiles' | 'selectedFolderPath' | 'pendingFileCreation' | 'pendingFolderCreation' | 'lastCreatedFile' | 'history' | 'recentWorkspaces'> {
  return {
    rootPath,
    tree,
    openFiles: [],
    activeFileId: null,
    closedFiles: [],
    selectedFolderPath: rootPath,
    pendingFileCreation: null,
    pendingFolderCreation: null,
    lastCreatedFile: null,
    history: { back: [], forward: [], current: null },
    recentWorkspaces: upsertRecentWorkspace(state.recentWorkspaces, rootPath),
  };
}

function workspaceSessionPatch(
  state: WorkspaceState,
  workspace: WorkspaceSession,
): Pick<WorkspaceState, 'rootPath' | 'tree' | 'openFiles' | 'activeFileId' | 'closedFiles' | 'selectedFolderPath' | 'pendingFileCreation' | 'pendingFolderCreation' | 'lastCreatedFile' | 'history' | 'recentWorkspaces'> {
  const normalizedWorkspace = normalizeRestoredWorkspace(workspace);
  const openFiles = normalizedWorkspace.openFiles;
  seedEditHistories(openFiles);
  const activeFileId =
    normalizedWorkspace.activeFileId && openFiles.some((file) => file.id === normalizedWorkspace.activeFileId)
      ? normalizedWorkspace.activeFileId
      : openFiles[0]?.id ?? null;
  const activeFile = openFiles.find((file) => file.id === activeFileId) ?? null;

  return {
    rootPath: normalizedWorkspace.rootPath,
    tree: normalizedWorkspace.tree,
    openFiles,
    activeFileId,
    closedFiles: [],
    selectedFolderPath: normalizedWorkspace.rootPath,
    pendingFileCreation: null,
    pendingFolderCreation: null,
    lastCreatedFile: null,
    history: { back: [], forward: [], current: activeFile?.path ?? null },
    recentWorkspaces: normalizedWorkspace.rootPath
      ? upsertRecentWorkspace(state.recentWorkspaces, normalizedWorkspace.rootPath)
      : state.recentWorkspaces,
  };
}

function seedEditHistories(openFiles: OpenFile[]): void {
  for (const file of openFiles) {
    resetEditHistory(file.id, { content: file.content, selectionStart: 0, selectionEnd: 0 });
  }
}

function normalizeRestoredWorkspace(workspace: WorkspaceSession): WorkspaceSession {
  if (isLegacyStarterWorkspace(workspace)) {
    return {
      rootPath: null,
      tree: [],
      openFiles: [],
      activeFileId: null,
    };
  }

  return {
    rootPath: workspace.rootPath,
    tree: workspace.tree,
    openFiles: workspace.openFiles.map(normalizeRestoredOpenFile),
    activeFileId: workspace.activeFileId,
  };
}

function normalizeRestoredOpenFile(file: OpenFile): OpenFile {
  const lineEndings = detectLineEndings(file.savedContent ?? file.content);
  const encoding = normalizeTextEncoding(file.encoding);
  const savedEncoding = normalizeTextEncoding(file.savedEncoding ?? file.encoding);
  return {
    ...file,
    displayPath: file.displayPath ?? readablePathFromRawPath(file.path, file.name),
    encoding,
    savedEncoding,
    eol: file.eol ?? lineEndings.eol,
    hasMixedEol: file.hasMixedEol ?? lineEndings.mixed,
  };
}

function isLegacyStarterWorkspace(workspace: WorkspaceSession): boolean {
  return Boolean(
    workspace.rootPath?.startsWith('~/Documents/notes') &&
      workspace.openFiles.length > 0 &&
      workspace.openFiles.every((file) => file.path.startsWith('~/Documents/notes')),
  );
}

async function confirmDiscardDirtyWorkspace(openFiles: OpenFile[]): Promise<boolean> {
  const dirtyFiles = openFiles.filter((file) => isDirty(file));
  if (dirtyFiles.length === 0) return true;
  return requestConfirmation({
    title: translateCurrent('document.unsavedChanges'),
    message: translateCurrent('document.discardWorkspaceChanges', { count: dirtyFiles.length }),
    confirmLabel: translateCurrent('common.confirm'),
    cancelLabel: translateCurrent('common.cancel'),
    tone: 'danger',
  });
}

async function confirmEncodingChange(file: OpenFile): Promise<boolean> {
  if (file.encoding === file.savedEncoding || confirmedEncodingChanges.has(file.id)) return true;

  const confirmed = await requestConfirmation({
    title: translateCurrent('document.changeEncoding'),
    message: translateCurrent('document.encodingConfirm', {
      name: file.name,
      from: encodingLabel(file.savedEncoding),
      to: encodingLabel(file.encoding),
    }),
    confirmLabel: translateCurrent('common.confirm'),
    cancelLabel: translateCurrent('common.cancel'),
  });
  if (confirmed) confirmedEncodingChanges.add(file.id);
  return confirmed;
}

function normalizeTextEncoding(value: unknown): TextEncoding {
  switch (typeof value === 'string' ? value.toLowerCase() : value) {
    case 'utf-8-bom':
      return 'utf-8-bom';
    case 'utf-16le':
      return 'utf-16le';
    case 'utf-16be':
      return 'utf-16be';
    default:
      return 'utf-8';
  }
}

function encodingLabel(encoding: TextEncoding): string {
  switch (encoding) {
    case 'utf-8':
      return 'UTF-8';
    case 'utf-8-bom':
      return 'UTF-8 BOM';
    case 'utf-16le':
      return 'UTF-16 LE';
    case 'utf-16be':
      return 'UTF-16 BE';
  }
}

function parentFolderFromFilePath(path: string): string | null {
  if (isPlaceholderPath(path)) return null;
  if (isAndroidContentPath(path)) return null;

  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return null;
  return normalized.slice(0, index);
}

function shouldRetainWorkspaceRootForFile(rootPath: string | null, filePath: string): boolean {
  if (!rootPath || isPlaceholderPath(rootPath)) return false;
  if (rootPath.startsWith('~android/')) return isAndroidContentPath(filePath);
  if (isAndroidContentTreePath(rootPath) && isAndroidContentPath(filePath)) return true;
  return isPathWithinWorkspaceRoot(rootPath, filePath);
}

function isPathWithinWorkspaceRoot(rootPath: string, filePath: string): boolean {
  const normalizedRoot = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function caretAfterChange(before: string, after: string): { start: number; end: number } {
  let common = 0;
  const limit = Math.min(before.length, after.length);
  while (common < limit && before[common] === after[common]) common += 1;
  const caret = common + Math.max(0, after.length - before.length);
  return { start: caret, end: caret };
}

function applyEditSnapshot(
  set: (updater: (state: WorkspaceState) => Partial<WorkspaceState>) => void,
  id: string,
  snapshot: EditSnapshot,
): void {
  set((state) => ({
    openFiles: state.openFiles.map((file) =>
      file.id === id ? { ...file, content: snapshot.content } : file,
    ),
  }));
}

function upsertOpenFile(
  state: WorkspaceState,
  file: OpenFile,
): Pick<WorkspaceState, 'openFiles' | 'activeFileId' | 'history'> {
  const exists = state.openFiles.some((candidate) => candidate.id === file.id);
  return {
    openFiles: exists ? state.openFiles.map((candidate) => (candidate.id === file.id ? file : candidate)) : [...state.openFiles, file],
    activeFileId: file.id,
    history: {
      back: state.history.current ? [...state.history.back, state.history.current] : state.history.back,
      forward: [],
      current: file.path,
    },
  };
}

function activateOpenFile(
  state: WorkspaceState,
  file: OpenFile,
): Pick<WorkspaceState, 'activeFileId' | 'history'> {
  if (state.activeFileId === file.id) {
    return {
      activeFileId: file.id,
      history: {
        ...state.history,
        current: file.path,
      },
    };
  }

  return {
    activeFileId: file.id,
    history: {
      back: state.history.current ? [...state.history.back, state.history.current] : state.history.back,
      forward: [],
      current: file.path,
    },
  };
}

function upsertRecentWorkspace(recentWorkspaces: RecentWorkspace[], path: string): RecentWorkspace[] {
  if (isPlaceholderPath(path)) return recentWorkspaces;
  return [
    toRecentWorkspace(path),
    ...recentWorkspaces.filter((workspace) => workspace.path !== path),
  ].slice(0, 5);
}

function normalizeRecentWorkspaces(
  recentWorkspaces: RecentWorkspace[] | undefined,
  activeRootPath: string | null,
): RecentWorkspace[] {
  const merged = [
    ...(activeRootPath && !isPlaceholderPath(activeRootPath) ? [toRecentWorkspace(activeRootPath)] : []),
    ...(recentWorkspaces ?? []),
  ];
  const seen = new Set<string>();

  return merged
    .filter((workspace) => {
      if (!workspace.path || seen.has(workspace.path)) return false;
      seen.add(workspace.path);
      return true;
    })
    .map((workspace) => ({
      id: workspace.id || workspaceIdFromPath(workspace.path),
      path: workspace.path,
      name: workspace.name || workspaceDisplayName(workspace.path),
      openedAt: workspace.openedAt || Date.now(),
      windowId: workspace.windowId,
    }))
    .slice(0, 5);
}

function workspaceIdFromPath(path: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `ws_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function workspaceDisplayName(path: string): string {
  if (path.startsWith('~android/')) return path.slice('~android/'.length);
  if (isAndroidContentPath(path)) return androidContentWorkspaceDisplayName(path);

  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.split('/').filter(Boolean).pop() || path || 'Saekim';
}

function isAndroidContentPath(path: string | null): boolean {
  return Boolean(path?.startsWith('content://'));
}

function isAndroidContentTreePath(path: string | null): boolean {
  return Boolean(path?.startsWith('content://') && path.includes('/tree/'));
}

function androidContentWorkspaceDisplayName(path: string): string {
  try {
    const url = new URL(path);
    const treeId = androidTreeDocumentId(url);
    if (treeId) return androidDocumentIdDisplayName(treeId);
    return contentAuthorityLabel(path);
  } catch {
    return 'Android document';
  }
}

function androidTreeDocumentId(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  const treeIndex = parts.indexOf('tree');
  if (treeIndex < 0 || treeIndex + 1 >= parts.length) return null;
  return decodeURIComponent(parts[treeIndex + 1]);
}

function androidDocumentIdDisplayName(documentId: string): string {
  const withoutVolume = documentId.startsWith('primary:') ? documentId.slice('primary:'.length) : documentId;
  const normalized = withoutVolume.replace(/^\/+/, '');
  if (normalized === 'Download') return 'Downloads';
  if (normalized.startsWith('Download/')) return normalized.replace('Download', 'Downloads').replace(/\//g, ' / ');
  return normalized.replace(/\//g, ' / ') || 'Android document';
}
