import type { PreviewBoxKind } from '../../core/preview/renderObjectTypes';
import type { BlockKind } from '../../types/metadata';
import { blockKindFromDataset } from './layoutDom';

export function blockKindForPreviewBox(element: HTMLElement): BlockKind | null {
  const previewBoxKind = previewBoxKindFromDataset(element.dataset.previewBoxKind);
  if (!previewBoxKind) return null;

  if (previewBoxKind === 'image') return 'image';
  if (previewBoxKind === 'table') return 'table';
  if (previewBoxKind === 'katex') return 'katex';
  if (previewBoxKind === 'text') return textBlockKindForElement(element);
  if (previewBoxKind === 'markdown') return blockKindForLegacyElement(element);
  return null;
}

export function blockKindForSceneKeyElement(element: HTMLElement): BlockKind | null {
  return blockKindForLegacyElement(element) ?? textBlockKindForElement(element);
}

export function blockKindForLegacyElement(element: HTMLElement): BlockKind | null {
  if (element instanceof HTMLImageElement) return 'image';
  if (element.classList.contains('mermaid-block')) return 'mermaid';
  if (element.classList.contains('math-block')) return 'katex';
  if (element.tagName === 'TABLE') return 'table';
  if (element.tagName === 'PRE') return 'code';
  return blockKindFromDataset(element.dataset.blockKind);
}

export function legacyBlockKeyForElement(element: HTMLElement, blockKind: BlockKind): string {
  if (blockKind === 'image' && element instanceof HTMLImageElement) {
    return element.getAttribute('data-original-src') || element.getAttribute('src') || element.alt || 'image';
  }
  return stableBlockKey(element, blockKind);
}

function textBlockKindForElement(element: HTMLElement): BlockKind | null {
  if (element.tagName === 'BLOCKQUOTE') return 'blockquote';
  if (element.tagName === 'OL' || element.tagName === 'UL') return 'list';
  if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P'].includes(element.tagName)) return 'text';
  return null;
}

function previewBoxKindFromDataset(value: string | undefined): PreviewBoxKind | null {
  if (
    value === 'text' ||
    value === 'special' ||
    value === 'image' ||
    value === 'table' ||
    value === 'markdown' ||
    value === 'katex' ||
    value === 'html'
  ) {
    return value;
  }
  return null;
}

function stableBlockKey(element: HTMLElement, kind: BlockKind): string {
  const sourceLine = element.getAttribute('data-source-line') ?? '0';
  const sourceEndLine = element.getAttribute('data-source-end-line') ?? sourceLine;
  if (kind === 'code' && sourceLine !== '0') {
    const language = element.getAttribute('data-lang') ?? element.getAttribute('data-label') ?? '';
    return `${kind}:${sourceLine}:${language}`;
  }
  const text = element.dataset.source ?? element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return `${kind}:${sourceLine}-${sourceEndLine}:${stableHash(text)}`;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
