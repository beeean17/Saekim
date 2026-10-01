import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '../../store/settings';
import type { FileTreeNode } from '../../types/workspace';
import { TreeContextMenu } from './TreeContextMenu';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
  useSettingsStore.setState({ language: 'en' });
});

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

describe('tree context menu', () => {
  it('offers new file and new folder actions for folders', () => {
    const folder: FileTreeNode = {
      id: '/workspace/notes',
      name: 'notes',
      path: '/workspace/notes',
      type: 'folder',
    };
    const { container, onCreateFile, onCreateFolder } = renderMenu(folder);

    const labels = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .map((button) => button.textContent);
    expect(labels).toContain('New File');
    expect(labels).toContain('New Folder…');
    expect(labels).not.toContain('Duplicate');

    act(() => findButton(container, 'New File')?.click());
    expect(onCreateFile).toHaveBeenCalledOnce();

    const second = renderMenu(folder);
    act(() => findButton(second.container, 'New Folder…')?.click());
    expect(second.onCreateFolder).toHaveBeenCalledOnce();
  });
});

function renderMenu(node: FileTreeNode) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  const onCreateFile = vi.fn();
  const onCreateFolder = vi.fn();
  act(() => {
    root.render(createElement(TreeContextMenu, {
      node,
      position: { x: 10, y: 10 },
      onRename: vi.fn(),
      onCreateFile,
      onCreateFolder,
      onDuplicate: vi.fn(),
      onTrash: vi.fn(),
      onClose: vi.fn(),
    }));
  });
  return { container, onCreateFile, onCreateFolder };
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => button.textContent === label);
}
