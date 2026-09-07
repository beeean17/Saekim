import { create } from 'zustand';
import { Backend } from '../platform/common/backend';
import type { WorkspaceSession } from '../types/session';
import type { FileTreeNode, OpenFile, OpenFilePayload, RecentWorkspace } from '../types/workspace';

interface WorkspaceState {
  rootPath: string | null;
  tree: FileTreeNode[];
  openFiles: OpenFile[];
  recentWorkspaces: RecentWorkspace[];
  activeFileId: string | null;
  history: { back: string[]; forward: string[]; current: string | null };
  openFolder: () => Promise<void>;
  openWorkspace: (path: string) => Promise<void>;
  openFile: (path?: string) => Promise<void>;
  createFile: () => Promise<void>;
  toggleFolder: (path: string) => Promise<void>;
  setActiveFile: (id: string) => void;
  closeFile: (id: string) => void;
  updateContent: (id: string, text: string) => void;
  saveActive: () => Promise<void>;
  saveActiveAs: () => Promise<void>;
  refresh: () => Promise<void>;
  historyPrev: () => void;
  historyNext: () => void;
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
    const file = toOpenFile(opened.path, opened.name, opened.content, opened.displayPath ?? undefined);
    set((state) => upsertOpenFile(state, file));
    const folderPatch = await workspaceFolderPatchForOpenFile(file, get().rootPath);
    if (folderPatch && get().activeFileId === file.id) set((state) => applyFolderPatch(state, folderPatch));
  },
  createFile: async () => {
    try {
      const savedPath = await Backend.files.saveFileAs('', 'untitled.md');
      if (!savedPath) return;

      const file = toOpenFile(savedPath, fileNameFromPath(savedPath), '');
      set((state) => upsertOpenFile(state, file));
      const folderPatch = await workspaceFolderPatchForFile(savedPath);
      if (folderPatch) set((state) => applyFolderPatch(state, folderPatch));
      else await get().refresh();
    } catch (error) {
      console.error('새 파일 생성 실패:', error);
    }
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
    let nextActivePath: string | null = null;
    set((state) => {
      const closedIndex = state.openFiles.findIndex((file) => file.id === id);
      const closedFile = state.openFiles[closedIndex];
      const openFiles = state.openFiles.filter((file) => file.id !== id);
      const nextActiveFile =
        state.activeFileId === id ? openFiles[Math.max(0, Math.min(closedIndex, openFiles.length - 1))] ?? null : null;
      const activeFileId = nextActiveFile?.id ?? (state.activeFileId === id ? null : state.activeFileId);
      const closedPath = closedFile?.path;
      nextActivePath = nextActiveFile?.path ?? null;

      return {
        openFiles,
        activeFileId,
        history: {
          back: closedPath ? state.history.back.filter((path) => path !== closedPath) : state.history.back,
          forward: closedPath ? state.history.forward.filter((path) => path !== closedPath) : state.history.forward,
          current: nextActiveFile?.path ?? (state.history.current === closedPath ? null : state.history.current),
        },
      };
    });

    nextActivePath &&
      void workspaceFolderPatchForFile(nextActivePath).then((folderPatch) => {
        const activeFile = get().openFiles.find((candidate) => candidate.id === get().activeFileId);
        if (folderPatch && activeFile?.path === nextActivePath) set((state) => applyFolderPatch(state, folderPatch));
      });
  },
  updateContent: (id, text) =>
    set((state) => ({
      openFiles: state.openFiles.map((file) => (file.id === id ? { ...file, content: text } : file)),
    })),
  saveActive: async () => {
    const state = get();
    const file = state.openFiles.find((candidate) => candidate.id === state.activeFileId);
    if (!file) return;
    const savedPath = await Backend.files.saveFile(file.path.startsWith('~') ? null : file.path, file.content);
    if (!savedPath) return;
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
            }
          : candidate,
      ),
      activeFileId: current.activeFileId === file.id ? savedPath : current.activeFileId,
      history: {
        ...current.history,
        current: current.history.current === file.path ? savedPath : current.history.current,
      },
    }));
    const folderPatch = await workspaceFolderPatchForFile(savedPath);
    if (folderPatch) set((state) => applyFolderPatch(state, folderPatch));
    else await get().refresh();
  },
  saveActiveAs: async () => {
    const state = get();
    const file = state.openFiles.find((candidate) => candidate.id === state.activeFileId);
    if (!file) return;
    const savedPath = await Backend.files.saveFileAs(file.content, file.name);
    if (!savedPath) return;
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
            }
          : candidate,
      ),
      activeFileId: savedPath,
      history: {
        ...current.history,
        current: savedPath,
      },
    }));
    const folderPatch = await workspaceFolderPatchForFile(savedPath);
    if (folderPatch) set((state) => applyFolderPatch(state, folderPatch));
    else await get().refresh();
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
  historyPrev: () =>
    set((state) => {
      const previousPath = state.history.back[state.history.back.length - 1];
      if (!previousPath) return {};

      const file = state.openFiles.find((candidate) => candidate.path === previousPath);
      if (!file) return {};

      return {
        activeFileId: file.id,
        history: {
          back: state.history.back.slice(0, -1),
          forward: state.history.current ? [state.history.current, ...state.history.forward] : state.history.forward,
          current: previousPath,
        },
      };
    }),
  historyNext: () =>
    set((state) => {
      const nextPath = state.history.forward[0];
      if (!nextPath) return {};

      const file = state.openFiles.find((candidate) => candidate.path === nextPath);
      if (!file) return {};

      return {
        activeFileId: file.id,
        history: {
          back: state.history.current ? [...state.history.back, state.history.current] : state.history.back,
          forward: state.history.forward.slice(1),
          current: nextPath,
        },
      };
    }),
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
  return Boolean(file && file.content !== file.savedContent);
}

function toOpenFile(path: string, name: string, content: string, displayPath?: string): OpenFile {
  const eol = content.includes('\r\n') ? 'CRLF' : 'LF';
  return {
    id: path,
    path,
    displayPath: displayPath ?? readablePathFromRawPath(path, name),
    name,
    content,
    savedContent: content,
    encoding: 'UTF-8',
    eol,
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
): Pick<WorkspaceState, 'rootPath' | 'tree' | 'openFiles' | 'activeFileId' | 'history' | 'recentWorkspaces'> {
  return {
    rootPath,
    tree,
    openFiles: [],
    activeFileId: null,
    history: { back: [], forward: [], current: null },
    recentWorkspaces: upsertRecentWorkspace(state.recentWorkspaces, rootPath),
  };
}

function workspaceSessionPatch(
  state: WorkspaceState,
  workspace: WorkspaceSession,
): Pick<WorkspaceState, 'rootPath' | 'tree' | 'openFiles' | 'activeFileId' | 'history' | 'recentWorkspaces'> {
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
  return {
    ...file,
    displayPath: file.displayPath ?? readablePathFromRawPath(file.path, file.name),
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
  const dirtyFiles = openFiles.filter((file) => file.content !== file.savedContent);
  if (dirtyFiles.length === 0) return true;
  return window.confirm(`${dirtyFiles.length}개 파일의 저장되지 않은 변경사항을 버리고 워크스페이스를 전환할까요?`);
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
