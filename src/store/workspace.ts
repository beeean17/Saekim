import { create } from 'zustand';
import { Backend } from '../lib/backend';
import type { FileTreeNode, OpenFile } from '../types/workspace';

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
  activeFileId: string | null;
  history: { back: string[]; forward: string[]; current: string | null };
  openFolder: () => Promise<void>;
  openFile: (path?: string) => Promise<void>;
  setActiveFile: (id: string) => void;
  closeFile: (id: string) => void;
  updateContent: (id: string, text: string) => void;
  saveActive: () => Promise<void>;
  saveActiveAs: () => Promise<void>;
  refresh: () => Promise<void>;
  historyPrev: () => void;
  historyNext: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rootPath: '~/Documents/notes',
  tree: initialTree,
  openFiles: [initialFile],
  activeFileId: initialFile.id,
  history: { back: [], forward: [], current: initialFile.path },
  openFolder: async () => undefined,
  openFile: async (path) => {
    if (!path) {
      const opened = await Backend.openFileDialog();
      if (!opened) return;
      const file = toOpenFile(opened.path, opened.name, opened.content);
      set((state) => upsertOpenFile(state, file));
      return;
    }

    const existing = get().openFiles.find((file) => file.path === path);
    if (existing) {
      set({ activeFileId: existing.id });
      return;
    }

    const name = path.split('/').pop() || 'untitled.md';
    const file = toOpenFile(path, name, starterContent);
    set((state) => upsertOpenFile(state, file));
  },
  setActiveFile: (id) => set({ activeFileId: id }),
  closeFile: (id) =>
    set((state) => {
      const openFiles = state.openFiles.filter((file) => file.id !== id);
      const activeFileId = state.activeFileId === id ? openFiles[0]?.id ?? null : state.activeFileId;
      return { openFiles, activeFileId };
    }),
  updateContent: (id, text) =>
    set((state) => ({
      openFiles: state.openFiles.map((file) => (file.id === id ? { ...file, content: text } : file)),
    })),
  saveActive: async () => {
    const state = get();
    const file = state.openFiles.find((candidate) => candidate.id === state.activeFileId);
    if (!file) return;
    const savedPath = await Backend.saveFile(file.path.startsWith('~') ? null : file.path, file.content);
    set((current) => ({
      openFiles: current.openFiles.map((candidate) =>
        candidate.id === file.id
          ? {
              ...candidate,
              path: savedPath || candidate.path,
              savedContent: candidate.content,
            }
          : candidate,
      ),
    }));
  },
  saveActiveAs: async () => {
    const state = get();
    const file = state.openFiles.find((candidate) => candidate.id === state.activeFileId);
    if (!file) return;
    const savedPath = await Backend.saveFileAs(file.content, file.name);
    if (!savedPath) return;
    set((current) => ({
      openFiles: current.openFiles.map((candidate) =>
        candidate.id === file.id
          ? {
              ...candidate,
              id: savedPath,
              path: savedPath,
              name: savedPath.split('/').pop() || candidate.name,
              savedContent: candidate.content,
            }
          : candidate,
      ),
      activeFileId: savedPath,
    }));
  },
  refresh: async () => undefined,
  historyPrev: () => undefined,
  historyNext: () => undefined,
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
