import type { FileTreeNode } from '../types/workspace';
import { translateCurrent } from '../i18n/current';

/**
 * Pure helpers over the workspace file tree.
 *
 * Nothing here reads the store: every function takes the nodes it works on, so
 * the tree shape can be reasoned about and tested without standing up a store.
 */

export function fileNameFromPath(path: string): string {
  return path.split('/').pop() || 'untitled.md';
}

export function isPlaceholderPath(path: string): boolean {
  return path.startsWith('~');
}

export function isWorkspaceEntryPath(path: string, parentPath: string): boolean {
  return path === parentPath || path.startsWith(`${parentPath}/`) || path.startsWith(`${parentPath}\\`);
}

export function mapWorkspaceEntryPath(path: string, previousPath: string, nextPath: string): string {
  if (path === previousPath) return nextPath;
  if (!isWorkspaceEntryPath(path, previousPath)) return path;
  return `${nextPath}${path.slice(previousPath.length)}`;
}

export function findTreeNode(nodes: readonly FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const child = findTreeNode(node.children, path);
      if (child) return child;
    }
  }

  return null;
}

export function updateTreeFolder(nodes: FileTreeNode[], path: string, patch: Partial<FileTreeNode>): FileTreeNode[] {
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

export function compareTreeNodes(left: FileTreeNode, right: FileTreeNode): number {
  if (left.type !== right.type) return left.type === 'folder' ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}

export function mergeTreeNodes(incoming: readonly FileTreeNode[], previous: readonly FileTreeNode[]): FileTreeNode[] {
  const previousByPath = new Map(previous.map((node) => [node.path, node]));
  return incoming.map((node) => {
    if (node.type !== 'folder') return node;
    const old = previousByPath.get(node.path);
    if (!old || old.type !== 'folder') return node;
    const children = node.children
      ? mergeTreeNodes(node.children, old.children ?? [])
      : old.isOpen
        ? old.children
        : node.children;
    return {
      ...node,
      children,
      isLoaded: node.isLoaded || old.isLoaded,
      isOpen: old.isOpen ?? node.isOpen,
    };
  });
}

export function folderChildrenAreLoaded(tree: readonly FileTreeNode[], path: string): boolean {
  const folder = findTreeNode(tree, path);
  return folder?.type === 'folder' && folder.isLoaded === true;
}

export function renameTreeEntryPaths(
  nodes: readonly FileTreeNode[],
  previousPath: string,
  nextPath: string,
): FileTreeNode[] {
  return nodes.map((node) => {
    const path = mapWorkspaceEntryPath(node.path, previousPath, nextPath);
    return {
      ...node,
      id: mapWorkspaceEntryPath(node.id, previousPath, nextPath),
      path,
      name: node.path === previousPath ? fileNameFromPath(path) : node.name,
      children: node.children ? renameTreeEntryPaths(node.children, previousPath, nextPath) : undefined,
    };
  });
}

export function removeTreeEntry(nodes: readonly FileTreeNode[], removedPath: string): FileTreeNode[] {
  return nodes
    .filter((node) => !isWorkspaceEntryPath(node.path, removedPath))
    .map((node) => ({
      ...node,
      children: node.children ? removeTreeEntry(node.children, removedPath) : undefined,
    }));
}

export function nextWorkspaceFileName(tree: readonly FileTreeNode[]): string {
  const names = new Set(tree.map((node) => node.name.toLocaleLowerCase()));
  for (let index = 1; index <= 10_000; index += 1) {
    const candidate = index === 1 ? 'untitled.md' : `untitled-${index}.md`;
    if (!names.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `untitled-${Date.now()}.md`;
}

export function nextWorkspaceFolderName(tree: readonly FileTreeNode[]): string {
  const baseName = translateCurrent('sidebar.defaultFolderName');
  const names = new Set(tree.map((node) => node.name.toLocaleLowerCase()));
  for (let index = 1; index <= 10_000; index += 1) {
    const candidate = index === 1 ? baseName : `${baseName} ${index}`;
    if (!names.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${baseName} ${Date.now()}`;
}
