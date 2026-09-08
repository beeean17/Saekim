import { create } from 'zustand';
import { detectLineEndings, serializeLineEndings } from '../core/document/lineEndings';
import { Backend } from '../platform/common/backend';
import type { WorkspaceSession } from '../types/session';
import type { FileTreeNode, OpenFile, OpenFilePayload, RecentWorkspace, TextEncoding } from '../types/workspace';

const confirmedEncodingChanges = new Set<string>();

interface WorkspaceState {
  rootPath: string | null;
  tree: FileTreeNode[];
  openFiles: OpenFile[];
  recentWorkspaces: RecentWorkspace[];
  activeFileId: string | null;
  closedFiles: OpenFile[];
  history: { back: string[]; forward: string[]; current: string | null };
  openFolder: () => Promise<void>;
  openWorkspace: (path: string) => Promise<void>;
  openFile: (path?: string) => Promise<void>;
  createFile: () => Promise<void>;
  toggleFolder: (path: string) => Promise<void>;
  setActiveFile: (id: string) => void;
  closeFile: (id: string) => void;
  reopenClosedFile: () => Promise<void>;
  updateContent: (id: string, text: string) => void;
  setEncoding: (id: string, encoding: TextEncoding) => void;
  saveFile: (id: string) => Promise<string | null>;
  saveActive: () => Promise<void>;
  saveActiveAs: () => Promise<void>;
  refresh: () => Promise<void>;
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
  history: { back: [], forward: [], current: null },
  openFolder: async () => {
    try {
      const rootPath = await Backend.folders.openFolderDialog();
      if (!rootPath) return;
      await get().openWorkspace(rootPath);
    } catch (error) {
      console.error('폴더 열기 실패:', error);
    }
  },
  openWorkspace: async (path) => {
    if (!path) return;
    if (!confirmDiscardDirtyWorkspace(get().openFiles)) return;

    try {
      const savedWorkspace = await Backend.metadata.loadWorkspaceSession(path);
      if (savedWorkspace) {
        let workspace = savedWorkspace;
        if (!workspace.tree.length && workspace.rootPath && !isPlaceholderPath(workspace.rootPath)) {
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
      }
      return;
    }

    const existing = get().openFiles.find((file) => file.path === path);
    if (existing) {
      set((state) => activateOpenFile(state, existing));
      const folderPatch = await workspaceFolderPatchForOpenFile(existing, get().rootPath);
      if (folderPatch && get().activeFileId === existing.id) set((state) => applyFolderPatch(state, folderPatch));
      return;
    }

    try {
      const opened = await Backend.files.readFile(path);
      await get().openFileFromPayload(opened);
    } catch (error) {
      console.error('파일 읽기 실패:', error);
    }
  },
  openFileFromPayload: async (opened) => {
    const file = toOpenFile(opened.path, opened.name, opened.content, opened.encoding, opened.displayPath ?? undefined);
    set((state) => upsertOpenFile(state, file));
    const folderPatch = await workspaceFolderPatchForOpenFile(file, get().rootPath);
    if (folderPatch && get().activeFileId === file.id) set((state) => applyFolderPatch(state, folderPatch));
  },
  createFile: async () => {
    const untitledNumber = nextUntitledNumber(get().openFiles);
    const file = toOpenFile(`~untitled-${untitledNumber}`, `untitled-${untitledNumber}.md`, '');
    set((state) => upsertOpenFile(state, file));
  },
  toggleFolder: async (path) => {
    const node = findTreeNode(get().tree, path);
    if (!node || node.type !== 'folder') return;

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

    set((state) => activateOpenFile(state, file));
    void workspaceFolderPatchForOpenFile(file, get().rootPath).then((folderPatch) => {
      const activeFile = get().openFiles.find((candidate) => candidate.id === get().activeFileId);
      if (folderPatch && activeFile?.path === file.path) set((state) => applyFolderPatch(state, folderPatch));
    });
  },
  closeFile: (id) => {
    confirmedEncodingChanges.delete(id);
    let nextActivePath: string | null = null;
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
      nextActivePath = nextActiveFile?.path ?? null;

      if (state.activeFileId !== id) {
        return { openFiles, activeFileId, closedFiles, history: state.history };
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
        history: {
          back,
          forward,
          current: nextActivePath,
        },
      };
    });

    nextActivePath &&
      void workspaceFolderPatchForFile(nextActivePath).then((folderPatch) => {
        const activeFile = get().openFiles.find((candidate) => candidate.id === get().activeFileId);
        if (folderPatch && activeFile?.path === nextActivePath) set((state) => applyFolderPatch(state, folderPatch));
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
  updateContent: (id, text) =>
    set((state) => ({
      openFiles: state.openFiles.map((file) => (file.id === id ? { ...file, content: text } : file)),
    })),
  setEncoding: (id, encoding) => {
    confirmedEncodingChanges.delete(id);
    set((state) => ({
      openFiles: state.openFiles.map((file) => (file.id === id ? { ...file, encoding } : file)),
    }));
  },
  saveFile: async (id) => {
    const file = get().openFiles.find((candidate) => candidate.id === id);
    if (!file) return null;
    if (!confirmEncodingChange(file)) return null;
    const savedPath = await Backend.files.saveFile(
      file.path.startsWith('~') ? null : file.path,
      serializeLineEndings(file.content, file.eol),
      file.encoding,
    );
    if (!savedPath) return null;
    confirmedEncodingChanges.delete(file.id);
    const savedFile = { path: savedPath, name: fileNameFromPath(savedPath) };
    set((current) => ({
      openFiles: current.openFiles.map((candidate) =>
        candidate.id === file.id
          ? {
              ...candidate,
              id: savedPath,
              path: savedPath,
              displayPath: savedPath,
              name: savedFile.name,
              savedContent: candidate.content,
              savedEncoding: candidate.encoding,
              hasMixedEol: false,
            }
          : candidate,
      ),
      activeFileId: current.activeFileId === file.id ? savedPath : current.activeFileId,
      history: {
        ...replaceHistoryPath(current.history, file.path, savedPath),
      },
    }));
    try {
      await Backend.metadata.deleteDocumentDraft(file.path);
    } catch (error) {
      console.error('임시 문서 정리 실패:', error);
    }
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
    if (!confirmEncodingChange(file)) return;
    const savedPath = await Backend.files.saveFileAs(
      serializeLineEndings(file.content, file.eol),
      file.name,
      file.encoding,
    );
    if (!savedPath) return;
    confirmedEncodingChanges.delete(file.id);
    const savedFile = { path: savedPath, name: fileNameFromPath(savedPath) };
    set((current) => ({
      openFiles: current.openFiles.map((candidate) =>
        candidate.id === file.id
          ? {
              ...candidate,
              id: savedPath,
              path: savedPath,
              displayPath: savedPath,
              name: savedFile.name,
              savedContent: candidate.content,
              savedEncoding: candidate.encoding,
              hasMixedEol: false,
            }
          : candidate,
      ),
      activeFileId: savedPath,
      history: {
        ...replaceHistoryPath(current.history, file.path, savedPath),
      },
    }));
    try {
      await Backend.metadata.deleteDocumentDraft(file.path);
    } catch (error) {
      console.error('임시 문서 정리 실패:', error);
    }
    const folderPatch = await workspaceFolderPatchForOpenFile(
      { ...file, id: savedPath, path: savedPath, displayPath: savedPath, name: savedFile.name },
      get().rootPath,
    );
    if (folderPatch) set((state) => applyFolderPatch(state, folderPatch));
  },
  refresh: async () => {
    const { rootPath } = get();
    if (!rootPath || isPlaceholderPath(rootPath)) return;

    try {
      const folder = await Backend.folders.readFolder(rootPath);
      set({ rootPath: folder.rootPath, tree: folder.tree });
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
    const openFiles = normalizedWorkspace.openFiles;
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
      recentWorkspaces: normalizedWorkspace.rootPath
        ? upsertRecentWorkspace(get().recentWorkspaces, normalizedWorkspace.rootPath)
        : get().recentWorkspaces,
      history: { back: [], forward: [], current: activeFile?.path ?? null },
    });
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
      file = toOpenFile(opened.path, opened.name, opened.content, opened.encoding, opened.displayPath ?? undefined);
    } catch (error) {
      console.error('히스토리 파일 다시 열기 실패:', error);
      return;
    }
  }

  let navigated = false;
  set((state) => {
    const latestTargetPath = direction === 'back'
      ? state.history.back[state.history.back.length - 1]
      : state.history.forward[0];
    if (latestTargetPath !== targetPath) return {};

    const latestFile = state.openFiles.find((candidate) => candidate.path === targetPath) ?? file;
    navigated = true;
    return navigateToHistoryFile(state, latestFile, direction);
  });

  if (!navigated) return;
  const folderPatch = await workspaceFolderPatchForOpenFile(file, get().rootPath);
  const activeFile = get().openFiles.find((candidate) => candidate.id === get().activeFileId);
  if (folderPatch && activeFile?.path === targetPath) {
    set((state) => applyFolderPatch(state, folderPatch));
  }
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

function fileNameFromPath(path: string): string {
  return path.split('/').pop() || 'untitled.md';
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
): Pick<WorkspaceState, 'rootPath' | 'tree' | 'recentWorkspaces'> {
  return {
    ...patch,
    recentWorkspaces: patch.rootPath ? upsertRecentWorkspace(state.recentWorkspaces, patch.rootPath) : state.recentWorkspaces,
  };
}

function workspaceFolderPatch(
  state: WorkspaceState,
  rootPath: string,
  tree: FileTreeNode[],
): Pick<WorkspaceState, 'rootPath' | 'tree' | 'openFiles' | 'activeFileId' | 'closedFiles' | 'history' | 'recentWorkspaces'> {
  return {
    rootPath,
    tree,
    openFiles: [],
    activeFileId: null,
    closedFiles: [],
    history: { back: [], forward: [], current: null },
    recentWorkspaces: upsertRecentWorkspace(state.recentWorkspaces, rootPath),
  };
}

function workspaceSessionPatch(
  state: WorkspaceState,
  workspace: WorkspaceSession,
): Pick<WorkspaceState, 'rootPath' | 'tree' | 'openFiles' | 'activeFileId' | 'closedFiles' | 'history' | 'recentWorkspaces'> {
  const normalizedWorkspace = normalizeRestoredWorkspace(workspace);
  const openFiles = normalizedWorkspace.openFiles;
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
    history: { back: [], forward: [], current: activeFile?.path ?? null },
    recentWorkspaces: normalizedWorkspace.rootPath
      ? upsertRecentWorkspace(state.recentWorkspaces, normalizedWorkspace.rootPath)
      : state.recentWorkspaces,
  };
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

function confirmDiscardDirtyWorkspace(openFiles: OpenFile[]): boolean {
  const dirtyFiles = openFiles.filter((file) => isDirty(file));
  if (dirtyFiles.length === 0) return true;
  return window.confirm(`${dirtyFiles.length}개 파일의 저장되지 않은 변경사항을 버리고 워크스페이스를 전환할까요?`);
}

function confirmEncodingChange(file: OpenFile): boolean {
  if (file.encoding === file.savedEncoding || confirmedEncodingChanges.has(file.id)) return true;

  const confirmed = window.confirm(
    `${file.name}의 인코딩을 ${encodingLabel(file.savedEncoding)}에서 ${encodingLabel(file.encoding)}(으)로 변경해 저장할까요?`,
  );
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

function isPlaceholderPath(path: string): boolean {
  return path.startsWith('~');
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

function findTreeNode(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const child = findTreeNode(node.children, path);
      if (child) return child;
    }
  }

  return null;
}

function updateTreeFolder(nodes: FileTreeNode[], path: string, patch: Partial<FileTreeNode>): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === path && node.type === 'folder') {
      return { ...node, ...patch };
    }

    if (node.children) {
      return { ...node, children: updateTreeFolder(node.children, path, patch) };
    }

    return node;
  });
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
