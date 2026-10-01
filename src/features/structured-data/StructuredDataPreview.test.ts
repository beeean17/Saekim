import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { FileTypeInfo } from '../../core/document/fileType';
import { StructuredDataPreview, TabularDataPreview } from './StructuredDataPreview';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const jsonFileType: FileTypeInfo = {
  label: 'json',
  language: 'json',
  previewKind: 'structured-data',
};

const csvFileType: FileTypeInfo = {
  label: 'csv',
  language: 'csv',
  previewKind: 'tabular-data',
};

const mountedRoots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

describe('structured data preview modes', () => {
  it('keeps the JSON mode tabs available when switching to raw and back to tree', () => {
    const container = renderPreview(
      createElement(StructuredDataPreview, {
        content: '{"name":"Saekim","version":4}',
        fileType: jsonFileType,
        fileKey: 'data.json',
      }),
    );

    clickButton(container, '원문');
    expect(buttonLabels(container)).toEqual(['트리', '원문']);
    expect(container.querySelector('.plain-text-preview')).not.toBeNull();

    clickButton(container, '트리');
    expect(buttonLabels(container)).toEqual(['트리', '원문']);
    expect(container.querySelector('.tree-preview')).not.toBeNull();
  });

  it('keeps the CSV mode tabs available when switching to raw and back to table', () => {
    const container = renderPreview(
      createElement(TabularDataPreview, {
        content: 'name,count\nSaekim,4',
        fileType: csvFileType,
      }),
    );

    clickButton(container, '원문');
    expect(buttonLabels(container)).toEqual(['표', '원문']);
    expect(container.querySelector('.plain-text-preview')).not.toBeNull();

    clickButton(container, '표');
    expect(buttonLabels(container)).toEqual(['표', '원문']);
    expect(container.querySelector('.data-table-preview')).not.toBeNull();
  });
});

function renderPreview(node: ReturnType<typeof createElement>): HTMLDivElement {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  act(() => root.render(node));
  return container;
}

function clickButton(container: HTMLElement, label: string): void {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === label);
  expect(button).toBeDefined();
  act(() => button?.click());
}

function buttonLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.preview-mode-tabs button')).map((button) => button.textContent ?? '');
}
