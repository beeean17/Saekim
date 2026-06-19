import {
  ImageRenderBlock,
  KatexRenderBlock,
  MarkdownRenderBlock,
  TableRenderBlock,
  TextBox,
} from '../../core/preview/renderObjects';
import { previewBoxId } from '../../core/preview/renderObjectTypes';
import type { PreviewRenderSceneEntry } from '../../core/preview/renderScene';
import { PreviewRenderScene, previewRenderSceneId, previewSceneDomKey } from '../../core/preview/renderScene';

interface MarkdownSceneResult {
  readonly html: string;
  readonly scene: PreviewRenderScene;
}

type MarkdownSceneElementKind = 'image' | 'table' | 'katex' | 'markdown' | 'text';

const initialBounds = { x: 0, y: 0, width: 100, height: 48 };

export function createMarkdownRenderScene(source: string, html: string): MarkdownSceneResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<main>${html}</main>`, 'text/html');
  const root = doc.querySelector('main');
  const entries: PreviewRenderSceneEntry[] = [];

  if (root) {
    Array.from(root.children).forEach((child) => {
      if (child instanceof HTMLElement) visitElement(child, source, entries);
    });
  }

  return {
    html: root?.innerHTML ?? html,
    scene: new PreviewRenderScene(previewRenderSceneId(stableHash(source)), 'markdown', entries),
  };
}

function visitElement(element: HTMLElement, source: string, entries: PreviewRenderSceneEntry[]): void {
  if (element.tagName === 'P' && isSingleImageParagraph(element)) {
    Array.from(element.children).forEach((child) => {
      if (child instanceof HTMLElement) {
        inheritSourceLines(element, child);
        visitElement(child, source, entries);
      }
    });
    return;
  }

  const kind = markdownSceneElementKind(element);
  if (kind) {
    appendSceneEntry(element, kind, source, entries);
    return;
  }

  Array.from(element.children).forEach((child) => {
    if (child instanceof HTMLElement) visitElement(child, source, entries);
  });
}

function appendSceneEntry(
  element: HTMLElement,
  kind: MarkdownSceneElementKind,
  source: string,
  entries: PreviewRenderSceneEntry[],
): void {
  const sourceLine = sourceLineNumber(element, 'sourceLine');
  const sourceEndLine = sourceLineNumber(element, 'sourceEndLine') ?? sourceLine;
  const domKey = previewSceneDomKey(`${kind}:${sourceLine ?? 0}:${entries.length}`);
  const text = sourceSnippet(source, sourceLine, sourceEndLine) || element.textContent?.trim() || '';
  const box = sceneBoxForElement(element, kind, domKey, text);

  element.dataset.previewBoxKey = domKey;
  entries.push({ box, domKey, sourceLine, sourceEndLine });
}

function markdownSceneElementKind(element: HTMLElement): MarkdownSceneElementKind | null {
  if (element instanceof HTMLImageElement) return 'image';
  if (element instanceof HTMLTableElement) return 'table';
  if (element.classList.contains('math-block')) return 'katex';
  if (element.tagName === 'PRE' || element.classList.contains('mermaid-block')) return 'markdown';
  if (isTextBlockElement(element)) return 'text';
  return null;
}

function sceneBoxForElement(
  element: HTMLElement,
  kind: MarkdownSceneElementKind,
  domKey: string,
  text: string,
) {
  const id = previewBoxId(domKey);

  switch (kind) {
    case 'image':
      return new ImageRenderBlock({
        id,
        bounds: initialBounds,
        text,
        item: {
          src: element.getAttribute('src') ?? '',
          alt: element.getAttribute('alt') ?? '',
          intrinsicSize: null,
        },
      });
    case 'table':
      return new TableRenderBlock({
        id,
        bounds: initialBounds,
        text,
        item: tableBlockItem(element),
      });
    case 'katex':
      return new KatexRenderBlock({
        id,
        bounds: initialBounds,
        text,
        item: { expression: text, displayMode: true },
      });
    case 'markdown':
      return new MarkdownRenderBlock({
        id,
        bounds: initialBounds,
        text,
        item: { source: text, renderedHtml: element.outerHTML },
      });
    case 'text':
      return new TextBox({ id, bounds: initialBounds, text });
    default:
      return assertNever(kind);
  }
}

function tableBlockItem(table: HTMLElement) {
  const headers = Array.from(table.querySelectorAll('thead th')).map((cell) => cell.textContent?.trim() ?? '');
  const rows = Array.from(table.querySelectorAll('tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent?.trim() ?? ''),
  );
  return { columns: headers, rows };
}

function isTextBlockElement(element: HTMLElement): boolean {
  return ['BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'OL', 'P', 'UL'].includes(element.tagName);
}

function isSingleImageParagraph(paragraph: HTMLElement): boolean {
  const children = Array.from(paragraph.childNodes);
  const imageCount = children.filter((node) => node instanceof HTMLImageElement).length;
  if (imageCount !== 1) return false;

  return children.every((node) => {
    if (node.nodeType === Node.TEXT_NODE) return !node.textContent?.trim();
    if (node instanceof HTMLBRElement) return true;
    return node instanceof HTMLImageElement;
  });
}

function sourceLineNumber(element: HTMLElement, key: 'sourceLine' | 'sourceEndLine'): number | null {
  const value = element.dataset[key];
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function inheritSourceLines(parent: HTMLElement, child: HTMLElement): void {
  if (!child.dataset.sourceLine && parent.dataset.sourceLine) {
    child.dataset.sourceLine = parent.dataset.sourceLine;
  }
  if (!child.dataset.sourceEndLine && parent.dataset.sourceEndLine) {
    child.dataset.sourceEndLine = parent.dataset.sourceEndLine;
  }
}

function sourceSnippet(source: string, sourceLine: number | null, sourceEndLine: number | null): string {
  if (sourceLine === null) return '';
  const lines = source.split('\n');
  const start = Math.max(0, sourceLine - 1);
  const end = sourceEndLine === null ? sourceLine : Math.max(sourceLine, sourceEndLine);
  return lines.slice(start, end).join('\n').trim();
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function assertNever(value: never): never {
  throw new Error(`Unsupported markdown scene element kind: ${String(value)}`);
}
