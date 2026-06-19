import type { BlockKind } from '../../types/metadata';

export function getLayoutWrappers(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.preview-layout-block')).filter((wrapper) =>
    isLayoutControlBlockKind(blockKindFromDataset(wrapper.dataset.blockKind)),
  );
}

export function blockKindFromDataset(value?: string): BlockKind | null {
  if (
    value === 'image' ||
    value === 'table' ||
    value === 'text' ||
    value === 'list' ||
    value === 'blockquote' ||
    value === 'code' ||
    value === 'mermaid' ||
    value === 'katex'
  ) {
    return value;
  }
  return null;
}

export function isLayoutControlBlockKind(value: BlockKind | null): boolean {
  return (
    value === 'text' ||
    value === 'image' ||
    value === 'table' ||
    value === 'list' ||
    value === 'blockquote' ||
    value === 'code' ||
    value === 'mermaid' ||
    value === 'katex'
  );
}

export function copySourceLineDataset(from: HTMLElement, to: HTMLElement): void {
  const startLine = from.getAttribute('data-source-line');
  const endLine = from.getAttribute('data-source-end-line') ?? startLine;
  if (startLine) to.dataset.sourceLine = startLine;
  if (endLine) to.dataset.sourceEndLine = endLine;
}

export function sourceStartLine(element: HTMLElement): number | null {
  const value = element.dataset.sourceLine ?? element.getAttribute('data-source-line');
  const line = Number.parseInt(value ?? '', 10);
  return Number.isFinite(line) ? line : null;
}

export function sourceEndLine(element: HTMLElement): number | null {
  const value = element.dataset.sourceEndLine ?? element.getAttribute('data-source-end-line') ?? element.dataset.sourceLine;
  const line = Number.parseInt(value ?? '', 10);
  return Number.isFinite(line) ? line : null;
}

export function normalizedOccurrenceIndex(value: string | undefined): number {
  const occurrenceIndex = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(occurrenceIndex) ? occurrenceIndex : 0;
}

export function isSingleImageParagraph(paragraph: HTMLElement): boolean {
  const children = Array.from(paragraph.childNodes);
  const imageCount = children.filter((node) => node instanceof HTMLImageElement).length;
  if (imageCount !== 1) return false;

  return children.every((node) => {
    if (node.nodeType === Node.TEXT_NODE) return !node.textContent?.trim();
    if (node instanceof HTMLBRElement) return true;
    return node instanceof HTMLImageElement;
  });
}
