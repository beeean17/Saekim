import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { MarkdownOutlineItem } from '../../core/markdown/renderer';
import type { OpenFile } from '../../types/workspace';
import { buildOutlineTree, OutlinePanel } from './OutlinePanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

describe('document outline hierarchy', () => {
  it('nests headings below the nearest preceding heading with a lower level', () => {
    const headings: MarkdownOutlineItem[] = [
      heading(1, 1, 'First'),
      heading(3, 3, 'Nested despite a skipped level'),
      heading(2, 5, 'Sibling branch'),
      heading(4, 7, 'Deep child'),
      heading(1, 9, 'Second'),
    ];

    const tree = buildOutlineTree(headings);

    expect(tree.map((node) => node.item.text)).toEqual(['First', 'Second']);
    expect(tree[0].children.map((node) => node.item.text)).toEqual([
      'Nested despite a skipped level',
      'Sibling branch',
    ]);
    expect(tree[0].children[1].children[0].item.text).toBe('Deep child');
  });

  it('collapses and expands every descendant of a heading', () => {
    const content = '# First\n\n## Child\n\n### Grandchild\n\n# Second';
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(createElement(OutlinePanel, {
        activeFile: openMarkdownFile(content),
        textareaRef: createRef<HTMLTextAreaElement>(),
        editorScrollRef: createRef<HTMLDivElement>(),
        previewRef: createRef<HTMLDivElement>(),
      }));
    });

    expect(outlineTitles(container)).toEqual(['First', 'Child', 'Grandchild', 'Second']);
    const firstToggle = container.querySelector<HTMLButtonElement>('.outline-toggle');
    expect(firstToggle?.getAttribute('aria-expanded')).toBe('true');

    act(() => firstToggle?.click());
    expect(outlineTitles(container)).toEqual(['First', 'Second']);
    expect(firstToggle?.getAttribute('aria-expanded')).toBe('false');

    act(() => firstToggle?.click());
    expect(outlineTitles(container)).toEqual(['First', 'Child', 'Grandchild', 'Second']);
  });
});

function heading(level: number, line: number, text: string): MarkdownOutlineItem {
  return { level, line, endLine: line, text };
}

function openMarkdownFile(content: string): OpenFile {
  return {
    id: '/workspace/document.md',
    path: '/workspace/document.md',
    displayPath: '/workspace/document.md',
    name: 'document.md',
    content,
    savedContent: content,
    encoding: 'utf-8',
    savedEncoding: 'utf-8',
    eol: 'LF',
  };
}

function outlineTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.outline-title')).map((title) => title.textContent ?? '');
}
