import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FileTreeNode } from '../../types/workspace';
import { EntryNameDialog, FileTreeNodeView, PendingFileInput } from './Sidebar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<ReturnType<typeof createRoot>> = [];
const pending = { id: 1, parentPath: '/workspace', name: 'untitled.md' };

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

describe('inline workspace file creation', () => {
  it('selects the default Markdown basename while leaving the extension editable', () => {
    const { input } = renderPendingInput();

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('untitled'.length);
    expect(input.value).toBe('untitled.md');
  });

  it('commits on Enter and when focus leaves the input', async () => {
    const entered = renderPendingInput();
    await act(async () => {
      entered.input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      await Promise.resolve();
    });
    expect(entered.onCommit).toHaveBeenCalledWith('untitled.md', true);

    const blurred = renderPendingInput();
    await act(async () => {
      blurred.input.focus();
      blurred.input.blur();
      await Promise.resolve();
    });
    expect(blurred.onCommit).toHaveBeenCalledWith('untitled.md', false);
  });

  it('cancels on Escape without creating a file', () => {
    const rendered = renderPendingInput();

    act(() => {
      rendered.input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });

    expect(rendered.onCancel).toHaveBeenCalledOnce();
    expect(rendered.onCommit).not.toHaveBeenCalled();
  });

  it('selects and toggles a folder on a single click', () => {
    /*
     * Selecting first and toggling on a second click doubled the clicks
     * needed to reach a nested file. toggleFolder also selects the folder,
     * so it stays the New File target.
     */
    const folder: FileTreeNode = {
      id: '/workspace/notes',
      name: 'notes',
      path: '/workspace/notes',
      type: 'folder',
      isOpen: false,
      isLoaded: true,
      children: [],
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push(root);
    const onToggle = vi.fn(async () => {});
    const render = (selectedFolderPath: string | null) => {
      act(() => {
        root.render(createElement(FileTreeNodeView, {
          node: folder,
          activePath: null,
          openFiles: [],
          pendingFileCreation: null,
          renameTargetPath: null,
          selectedFolderPath,
          contextTargetPath: null,
          onCancelFileCreation: vi.fn(),
          onCancelRename: vi.fn(),
          onCommitFileCreation: vi.fn(async () => {}),
          onCommitRename: vi.fn(async () => {}),
          onToggle,
          onOpen: vi.fn(),
          onPreviewImage: vi.fn(),
        }));
      });
    };

    render(null);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    act(() => button?.click());
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith(folder.path);

    render(folder.path);
    act(() => container.querySelector('button')?.click());
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('replaces the current file name with an inline rename input', async () => {
    const file: FileTreeNode = {
      id: '/workspace/draft.md',
      name: 'draft.md',
      path: '/workspace/draft.md',
      type: 'file',
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push(root);
    const onCancelRename = vi.fn();
    const onCommitRename = vi.fn(async () => {});
    act(() => {
      root.render(createElement(FileTreeNodeView, {
        node: file,
        activePath: null,
        openFiles: [],
        pendingFileCreation: null,
        renameTargetPath: file.path,
        selectedFolderPath: null,
        contextTargetPath: null,
        onCancelFileCreation: vi.fn(),
        onCancelRename,
        onCommitFileCreation: vi.fn(async () => {}),
        onCommitRename,
        onToggle: vi.fn(async () => {}),
        onOpen: vi.fn(),
        onPreviewImage: vi.fn(),
      }));
    });

    const input = container.querySelector<HTMLInputElement>('.file.renaming input');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(input?.selectionStart).toBe(0);
    expect(input?.selectionEnd).toBe('draft'.length);

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      await Promise.resolve();
    });
    expect(onCommitRename).toHaveBeenCalledWith(file, 'draft.md');
    expect(onCancelRename).not.toHaveBeenCalled();
  });

  it('submits names through the in-app entry dialog', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push(root);
    const onSubmit = vi.fn(async () => {});
    act(() => {
      root.render(createElement(EntryNameDialog, {
        confirmLabel: 'Rename',
        initialName: 'draft.md',
        inputLabel: 'New name',
        operationId: 'rename-draft',
        selectBaseName: true,
        title: 'Rename draft.md',
        onClose: vi.fn(),
        onSubmit,
      }));
    });

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith('draft.md');
  });
});

function renderPendingInput() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  const onCancel = vi.fn();
  const onCommit = vi.fn(async () => {});
  act(() => {
    root.render(createElement(PendingFileInput, { pending, onCancel, onCommit }));
  });
  const input = container.querySelector('input');
  expect(input).not.toBeNull();
  return { input: input as HTMLInputElement, onCancel, onCommit };
}
