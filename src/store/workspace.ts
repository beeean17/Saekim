import { create } from 'zustand';
import { Backend } from '../platform/common/backend';
import type { WorkspaceSession } from '../types/session';
import type { FileTreeNode, OpenFile, RecentFile } from '../types/workspace';

const starterContent = `# Saekim 마크다운 에디터

실시간 미리보기와 *Mermaid*, *KaTeX*를 지원하는 한국어 친화 에디터.

## 주요 기능

- **파일 탐색**: 사이드바를 접고 펼치며 집중 모드 전환
- **확장형 툴바**: 기본 도구 + "모든 도구"로 전체 마크다운 노출
- **실시간 렌더링**: 입력 즉시 우측에서 결과 확인

## 수식 예시

$E = mc^2$

## 다이어그램 예시

\`\`\`mermaid
flowchart LR
  editor[편집기] --> parser[파서]
  parser --> preview[미리보기]
\`\`\`

> 탐색기 패널은 헤더 좌측 버튼으로 토글합니다.
`;

const now = Date.now();

const initialTree: FileTreeNode[] = [
  {
    id: 'notes',
    name: 'notes',
    type: 'folder',
    path: '~/Documents/notes',
    isOpen: true,
    children: [
      { id: 'readme', name: 'readme.md', type: 'file', path: '~/Documents/notes/readme.md', modifiedAt: now },
      { id: 'project-plan', name: 'project_plan.md', type: 'file', path: '~/Documents/notes/project_plan.md', modifiedAt: now - 2 * 60 * 60 * 1000 },
      { id: 'api-reference', name: 'api-reference.md', type: 'file', path: '~/Documents/notes/api-reference.md', modifiedAt: now - 24 * 60 * 60 * 1000 },
      { id: 'diagrams', name: 'diagrams.md', type: 'file', path: '~/Documents/notes/diagrams.md', modifiedAt: now - 3 * 24 * 60 * 60 * 1000 },
    ],
  },
  {
    id: 'drafts',
    name: 'drafts',
    type: 'folder',
    path: '~/Documents/notes/drafts',
    isOpen: true,
    children: [
      { id: 'untitled', name: 'untitled.md', type: 'file', path: '~/Documents/notes/drafts/untitled.md', modifiedAt: now - 7 * 24 * 60 * 60 * 1000 },
      { id: 'retrospective', name: 'retrospective.md', type: 'file', path: '~/Documents/notes/drafts/retrospective.md', modifiedAt: now - 14 * 24 * 60 * 60 * 1000 },
    ],
  },
  {
    id: 'archive',
    name: 'archive',
    type: 'folder',
    path: '~/Documents/archive',
    isOpen: false,
  },
];

const initialFile: OpenFile = {
  id: '~/Documents/notes/readme.md',
  path: '~/Documents/notes/readme.md',
  name: 'readme.md',
  content: starterContent,
  savedContent: starterContent.replace('실시간 미리보기와', '빠른 미리보기와'),
  encoding: 'UTF-8',
  eol: 'LF',
};

interface WorkspaceState {
  rootPath: string | null;
  tree: FileTreeNode[];
  openFiles: OpenFile[];
  recentFiles: RecentFile[];
  activeFileId: string | null;
  history: { back: string[]; forward: string[]; current: string | null };
  openFolder: () => Promise<void>;
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
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rootPath: '~/Documents/notes',
  tree: initialTree,
  openFiles: [initialFile],
  recentFiles: [toRecentFile(initialFile)],
  activeFileId: initialFile.id,
  history: { back: [], forward: [], current: initialFile.path },
  openFolder: async () => {
    try {
      const rootPath = await Backend.folders.openFolderDialog();
      if (!rootPath) return;
      set({ rootPath, tree: [] });
      const folder = await Backend.folders.readFolder(rootPath);
      set({ rootPath: folder.rootPath, tree: folder.tree });
    } catch (error) {
      console.error('폴더 열기 실패:', error);
    }
  },
  openFile: async (path) => {
    if (!path) {
      try {
        await Backend.files.openFileDialog();
      } catch (error) {
        console.error('파일 열기 실패:', error);
      }
      return;
    }

    const existing = get().openFiles.find((file) => file.path === path);
    if (existing) {
      set((state) => activateOpenFile(state, existing));
      const folderPatch = await workspaceFolderPatchForFile(existing.path);
      if (folderPatch && get().activeFileId === existing.id) set(folderPatch);
      return;
    }

    if (isPlaceholderPath(path)) {
      const name = path.split('/').pop() || 'untitled.md';
      const file = toOpenFile(path, name, starterContent);
      set((state) => upsertOpenFile(state, file));
      return;
    }

    try {
      const opened = await Backend.files.readFile(path);
      const file = toOpenFile(opened.path, opened.name, opened.content);
      set((state) => upsertOpenFile(state, file));
      const folderPatch = await workspaceFolderPatchForFile(opened.path);
      if (folderPatch && get().activeFileId === file.id) set(folderPatch);
    } catch (error) {
      console.error('파일 읽기 실패:', error);
    }
  },
  createFile: async () => {
    try {
      const savedPath = await Backend.files.saveFileAs('', 'untitled.md');
      if (!savedPath) return;

      const file = toOpenFile(savedPath, fileNameFromPath(savedPath), '');
      set((state) => upsertOpenFile(state, file));
      const folderPatch = await workspaceFolderPatchForFile(savedPath);
      if (folderPatch) set(folderPatch);
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
    void workspaceFolderPatchForFile(file.path).then((folderPatch) => {
      const activeFile = get().openFiles.find((candidate) => candidate.id === get().activeFileId);
      if (folderPatch && activeFile?.path === file.path) set(folderPatch);
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
        recentFiles: closedPath ? state.recentFiles.filter((file) => file.path !== closedPath) : state.recentFiles,
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
        if (folderPatch && activeFile?.path === nextActivePath) set(folderPatch);
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
              name: savedFile.name,
              savedContent: candidate.content,
            }
          : candidate,
      ),
      activeFileId: current.activeFileId === file.id ? savedPath : current.activeFileId,
      recentFiles: upsertRecentFile(
        current.recentFiles.filter((candidate) => candidate.path !== file.path),
        savedPath,
        savedFile.name,
      ),
      history: {
        ...current.history,
        current: current.history.current === file.path ? savedPath : current.history.current,
      },
    }));
    const folderPatch = await workspaceFolderPatchForFile(savedPath);
    if (folderPatch) set(folderPatch);
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
              name: savedFile.name,
              savedContent: candidate.content,
            }
          : candidate,
      ),
      activeFileId: savedPath,
      recentFiles: upsertRecentFile(
        current.recentFiles.filter((candidate) => candidate.path !== file.path),
        savedPath,
        savedFile.name,
      ),
      history: {
        ...current.history,
        current: savedPath,
      },
    }));
    const folderPatch = await workspaceFolderPatchForFile(savedPath);
    if (folderPatch) set(folderPatch);
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
    const openFiles = workspace.openFiles;
    const activeFileId =
      workspace.activeFileId && openFiles.some((file) => file.id === workspace.activeFileId)
        ? workspace.activeFileId
        : openFiles[0]?.id ?? null;
    set({
      rootPath: workspace.rootPath,
      tree: workspace.tree.length > 0 ? workspace.tree : initialTree,
      openFiles,
      recentFiles: normalizeRecentFiles(workspace.recentFiles, openFiles),
      activeFileId,
    });
  },
}));

export function selectActiveFile(state: WorkspaceState): OpenFile | null {
  return state.openFiles.find((file) => file.id === state.activeFileId) ?? null;
}

export function isDirty(file: OpenFile | null): boolean {
  return Boolean(file && file.content !== file.savedContent);
}

function toOpenFile(path: string, name: string, content: string): OpenFile {
  const eol = content.includes('\r\n') ? 'CRLF' : 'LF';
  return {
    id: path,
    path,
    name,
    content,
    savedContent: content,
    encoding: 'UTF-8',
    eol,
  };
}

function toRecentFile(file: Pick<OpenFile, 'path' | 'name'>): RecentFile {
  return {
    path: file.path,
    name: file.name,
    openedAt: Date.now(),
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

function parentFolderFromFilePath(path: string): string | null {
  if (isPlaceholderPath(path)) return null;

  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return null;
  return normalized.slice(0, index);
}

function isPlaceholderPath(path: string): boolean {
  return path.startsWith('~') || path.startsWith('browser://');
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
): Pick<WorkspaceState, 'openFiles' | 'recentFiles' | 'activeFileId' | 'history'> {
  const exists = state.openFiles.some((candidate) => candidate.id === file.id);
  return {
    openFiles: exists ? state.openFiles.map((candidate) => (candidate.id === file.id ? file : candidate)) : [...state.openFiles, file],
    recentFiles: upsertRecentFile(state.recentFiles, file.path, file.name),
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
): Pick<WorkspaceState, 'recentFiles' | 'activeFileId' | 'history'> {
  if (state.activeFileId === file.id) {
    return {
      activeFileId: file.id,
      recentFiles: upsertRecentFile(state.recentFiles, file.path, file.name),
      history: {
        ...state.history,
        current: file.path,
      },
    };
  }

  return {
    activeFileId: file.id,
    recentFiles: upsertRecentFile(state.recentFiles, file.path, file.name),
    history: {
      back: state.history.current ? [...state.history.back, state.history.current] : state.history.back,
      forward: [],
      current: file.path,
    },
  };
}

function upsertRecentFile(recentFiles: RecentFile[], path: string, name: string): RecentFile[] {
  return [
    { path, name, openedAt: Date.now() },
    ...recentFiles.filter((file) => file.path !== path),
  ].slice(0, 50);
}

function normalizeRecentFiles(recentFiles: RecentFile[] | undefined, openFiles: OpenFile[]): RecentFile[] {
  const merged = [...openFiles.map(toRecentFile), ...(recentFiles ?? [])];
  const seen = new Set<string>();
  return merged
    .filter((file) => {
      if (seen.has(file.path)) return false;
      seen.add(file.path);
      return true;
    })
    .slice(0, 50);
}
