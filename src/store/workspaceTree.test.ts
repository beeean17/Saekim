import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from '../types/workspace';
import {
  findTreeNode,
  folderChildrenAreLoaded,
  isPlaceholderPath,
  mapWorkspaceEntryPath,
  mergeTreeNodes,
  nextWorkspaceFileName,
  removeTreeEntry,
  renameTreeEntryPaths,
  updateTreeFolder,
} from './workspaceTree';

function folder(path: string, children?: FileTreeNode[], patch: Partial<FileTreeNode> = {}): FileTreeNode {
  const name = path.split('/').pop() ?? path;
  return { id: path, name, path, type: 'folder', children, ...patch };
}

function file(path: string): FileTreeNode {
  const name = path.split('/').pop() ?? path;
  return { id: path, name, path, type: 'file' };
}

describe('findTreeNode', () => {
  it('finds nodes nested under folders', () => {
    const tree = [folder('/w/docs', [file('/w/docs/a.md')])];

    expect(findTreeNode(tree, '/w/docs/a.md')?.name).toBe('a.md');
    expect(findTreeNode(tree, '/w/missing.md')).toBeNull();
  });
});

describe('updateTreeFolder', () => {
  it('patches only the targeted folder', () => {
    const tree = [folder('/w/docs', [file('/w/docs/a.md')]), folder('/w/img')];

    const next = updateTreeFolder(tree, '/w/docs', { isOpen: true, isLoaded: true });

    expect(findTreeNode(next, '/w/docs')?.isOpen).toBe(true);
    expect(findTreeNode(next, '/w/img')?.isOpen).toBeUndefined();
  });
});

describe('mergeTreeNodes', () => {
  it('keeps the open state of folders that already existed', () => {
    const previous = [folder('/w/docs', [file('/w/docs/a.md')], { isOpen: true, isLoaded: true })];
    const incoming = [folder('/w/docs')];

    const merged = mergeTreeNodes(incoming, previous);

    expect(merged[0].isOpen).toBe(true);
    expect(merged[0].isLoaded).toBe(true);
    expect(merged[0].children).toHaveLength(1);
  });

  it('leaves files untouched', () => {
    const merged = mergeTreeNodes([file('/w/a.md')], [file('/w/a.md')]);

    expect(merged[0].type).toBe('file');
  });
});

describe('renameTreeEntryPaths', () => {
  it('rewrites the renamed entry and its descendants', () => {
    const tree = [folder('/w/old', [file('/w/old/a.md')])];

    const next = renameTreeEntryPaths(tree, '/w/old', '/w/new');

    expect(next[0].path).toBe('/w/new');
    expect(next[0].name).toBe('new');
    expect(next[0].children?.[0].path).toBe('/w/new/a.md');
  });

  it('leaves unrelated siblings alone', () => {
    const tree = [folder('/w/old'), folder('/w/older')];

    const next = renameTreeEntryPaths(tree, '/w/old', '/w/new');

    expect(next.map((node) => node.path)).toEqual(['/w/new', '/w/older']);
  });
});

describe('removeTreeEntry', () => {
  it('removes the entry and everything beneath it', () => {
    const tree = [folder('/w/docs', [file('/w/docs/a.md')]), file('/w/keep.md')];

    const next = removeTreeEntry(tree, '/w/docs');

    expect(next.map((node) => node.path)).toEqual(['/w/keep.md']);
  });
});

describe('mapWorkspaceEntryPath', () => {
  it('maps the entry itself and its children, but not prefix lookalikes', () => {
    expect(mapWorkspaceEntryPath('/w/old', '/w/old', '/w/new')).toBe('/w/new');
    expect(mapWorkspaceEntryPath('/w/old/a.md', '/w/old', '/w/new')).toBe('/w/new/a.md');
    expect(mapWorkspaceEntryPath('/w/older', '/w/old', '/w/new')).toBe('/w/older');
  });
});

describe('nextWorkspaceFileName', () => {
  it('starts at untitled.md and steps past taken names case-insensitively', () => {
    expect(nextWorkspaceFileName([])).toBe('untitled.md');
    expect(nextWorkspaceFileName([file('/w/untitled.md')])).toBe('untitled-2.md');
    expect(nextWorkspaceFileName([file('/w/UNTITLED.MD')])).toBe('untitled-2.md');
  });
});

describe('folderChildrenAreLoaded', () => {
  it('is true only for folders explicitly marked loaded', () => {
    const tree = [folder('/w/loaded', [], { isLoaded: true }), folder('/w/lazy')];

    expect(folderChildrenAreLoaded(tree, '/w/loaded')).toBe(true);
    expect(folderChildrenAreLoaded(tree, '/w/lazy')).toBe(false);
    expect(folderChildrenAreLoaded(tree, '/w/missing')).toBe(false);
  });
});

describe('isPlaceholderPath', () => {
  it('treats the ~ prefix as an unsaved document', () => {
    expect(isPlaceholderPath('~untitled-1')).toBe(true);
    expect(isPlaceholderPath('/w/a.md')).toBe(false);
  });
});
