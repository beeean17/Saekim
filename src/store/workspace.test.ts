import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Backend } from '../platform/common/backend';
import type { WorkspaceSession } from '../types/session';
import type { FileTreeNode, OpenFile } from '../types/workspace';
import { useWorkspaceStore } from './workspace';

const workspaceTree: FileTreeNode[] = [
  { id: '/workspace/a.md', name: 'a.md', path: '/workspace/a.md', type: 'file' },
  { id: '/workspace/b.md', name: 'b.md', path: '/workspace/b.md', type: 'file' },
];

beforeEach(() => {
  useWorkspaceStore.setState({
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
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workspace explorer root', () => {
  it('does not replace the filesystem tree when the active tab is closed', () => {
    const first = openFile('/workspace/a.md');
    const next = openFile('/other/b.md');
    const readFolder = vi.spyOn(Backend.folders, 'readFolder');
    useWorkspaceStore.setState({
      rootPath: '/workspace',
      tree: workspaceTree,
      openFiles: [first, next],
      activeFileId: first.id,
      history: { back: [], forward: [], current: first.path },
    });

    useWorkspaceStore.getState().closeFile(first.id);

    const state = useWorkspaceStore.getState();
    expect(state.activeFileId).toBe(next.id);
    expect(state.rootPath).toBe('/workspace');
    expect(state.tree).toEqual(workspaceTree);
    expect(readFolder).not.toHaveBeenCalled();
  });

  it('does not replace the filesystem tree when switching tabs', () => {
    const first = openFile('/workspace/a.md');
    const next = openFile('/other/b.md');
    const readFolder = vi.spyOn(Backend.folders, 'readFolder');
    useWorkspaceStore.setState({
      rootPath: '/workspace',
      tree: workspaceTree,
      openFiles: [first, next],
      activeFileId: first.id,
      history: { back: [], forward: [], current: first.path },
    });

    useWorkspaceStore.getState().setActiveFile(next.id);

    const state = useWorkspaceStore.getState();
    expect(state.activeFileId).toBe(next.id);
    expect(state.rootPath).toBe('/workspace');
    expect(state.tree).toEqual(workspaceTree);
    expect(readFolder).not.toHaveBeenCalled();
  });

  it('reloads a saved workspace tree from its real folder', async () => {
    const staleTree: FileTreeNode[] = [
      { id: '/workspace/stale.md', name: 'stale.md', path: '/workspace/stale.md', type: 'file' },
    ];
    const savedWorkspace: WorkspaceSession = {
      rootPath: '/workspace',
      tree: staleTree,
      openFiles: [],
      activeFileId: null,
    };
    vi.spyOn(Backend.metadata, 'loadWorkspaceSession').mockResolvedValue(savedWorkspace);
    const readFolder = vi.spyOn(Backend.folders, 'readFolder').mockResolvedValue({
      rootPath: '/workspace',
      tree: workspaceTree,
    });

    await useWorkspaceStore.getState().openWorkspace('/workspace');

    expect(readFolder).toHaveBeenCalledWith('/workspace');
    expect(useWorkspaceStore.getState().tree).toEqual(workspaceTree);
  });

  it('commits an inline file name and can undo the empty file creation', async () => {
    const created = openFile('/workspace/untitled.md');
    const createdTree: FileTreeNode[] = [
      ...workspaceTree,
      { id: created.path, name: created.name, path: created.path, type: 'file' },
    ];
    const createFile = vi.spyOn(Backend.folders, 'createFile').mockResolvedValue({
      path: created.path,
      name: created.name,
      content: '',
      encoding: 'utf-8',
    });
    vi.spyOn(Backend.folders, 'readFolderChildren').mockResolvedValue(createdTree);
    vi.spyOn(Backend.folders, 'readFolder').mockResolvedValue({ rootPath: '/workspace', tree: workspaceTree });
    const trashEntry = vi.spyOn(Backend.folders, 'trashEntry').mockResolvedValue();
    useWorkspaceStore.setState({
      rootPath: '/workspace',
      tree: workspaceTree,
      pendingFileCreation: { id: 1, parentPath: '/workspace', name: 'untitled.md' },
    });

    await useWorkspaceStore.getState().commitFileCreation('untitled.md');

    expect(createFile).toHaveBeenCalledWith('/workspace', 'untitled.md');
    expect(useWorkspaceStore.getState().pendingFileCreation).toBeNull();
    expect(useWorkspaceStore.getState().activeFileId).toBe(created.path);
    expect(useWorkspaceStore.getState().tree).toEqual(createdTree);
    expect(useWorkspaceStore.getState().canUndoFileCreation()).toBe(true);

    await useWorkspaceStore.getState().undoFileCreation();

    expect(trashEntry).toHaveBeenCalledWith(created.path);
    expect(useWorkspaceStore.getState().openFiles).toEqual([]);
    expect(useWorkspaceStore.getState().tree).toEqual(workspaceTree);
    expect(useWorkspaceStore.getState().canUndoFileCreation()).toBe(false);
  });

  it('leaves the native editor undo available while a created file has content', () => {
    const created = openFile('/workspace/untitled.md');
    useWorkspaceStore.setState({
      rootPath: '/workspace',
      tree: workspaceTree,
      openFiles: [{ ...created, content: 'draft' }],
      activeFileId: created.path,
      lastCreatedFile: { path: created.path, rootPath: '/workspace' },
    });

    expect(useWorkspaceStore.getState().canUndoFileCreation()).toBe(false);
    useWorkspaceStore.getState().updateContent(created.path, '');
    expect(useWorkspaceStore.getState().canUndoFileCreation()).toBe(true);
  });

  it('creates a file inside the selected nested folder without replacing the explorer root', async () => {
    const folder: FileTreeNode = {
      id: '/workspace/notes',
      name: 'notes',
      path: '/workspace/notes',
      type: 'folder',
      children: [],
      isLoaded: true,
      isOpen: true,
    };
    const created = openFile('/workspace/notes/nested.md');
    vi.spyOn(Backend.folders, 'createFile').mockResolvedValue({
      path: created.path,
      name: created.name,
      content: '',
      encoding: 'utf-8',
    });
    vi.spyOn(Backend.folders, 'readFolderChildren').mockResolvedValue([
      { id: created.path, name: created.name, path: created.path, type: 'file' },
    ]);
    useWorkspaceStore.setState({
      rootPath: '/workspace',
      tree: [folder, ...workspaceTree],
      selectedFolderPath: folder.path,
      pendingFileCreation: { id: 2, parentPath: folder.path, name: 'nested.md' },
    });

    await useWorkspaceStore.getState().commitFileCreation('nested.md');

    const state = useWorkspaceStore.getState();
    expect(state.tree.map((node) => node.path)).toContain('/workspace/a.md');
    expect(state.tree.map((node) => node.path)).toContain('/workspace/b.md');
    expect(state.tree.find((node) => node.path === folder.path)?.children?.[0]?.path).toBe(created.path);
    expect(state.selectedFolderPath).toBe(folder.path);
  });

  it('closes every open tab below an entry after it is moved to the trash', () => {
    const removed = { ...openFile('/workspace/notes/removed.md'), id: 'open-tab:removed' };
    const sibling = openFile('/workspace/b.md');
    useWorkspaceStore.setState({
      rootPath: '/workspace',
      tree: workspaceTree,
      openFiles: [removed, sibling],
      activeFileId: removed.id,
      selectedFolderPath: '/workspace/notes',
      closedFiles: [removed],
      history: { back: [removed.path], forward: [removed.path], current: removed.path },
    });

    useWorkspaceStore.getState().removeWorkspaceEntry('/workspace/notes', [removed.id]);

    const state = useWorkspaceStore.getState();
    expect(state.openFiles).toEqual([sibling]);
    expect(state.activeFileId).toBe(sibling.id);
    expect(state.closedFiles).toEqual([]);
    expect(state.selectedFolderPath).toBe('/workspace');
    expect(state.history.back).toEqual([]);
    expect(state.history.forward).toEqual([]);
  });
});

function openFile(path: string): OpenFile {
  return {
    id: path,
    path,
    displayPath: path,
    name: path.split('/').pop() ?? path,
    content: '',
    savedContent: '',
    encoding: 'utf-8',
    savedEncoding: 'utf-8',
    eol: 'LF',
  };
}
