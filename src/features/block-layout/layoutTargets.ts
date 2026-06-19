import type { BlockKind } from '../../types/metadata';
import { isLayoutInteractionChromeNode } from './interactionMode';
import { layoutIdentityMatchForElement } from './layoutIdentity';
import { copySourceLineDataset, isSingleImageParagraph } from './layoutDom';
import {
  blockKindForLegacyElement,
  blockKindForPreviewBox,
  blockKindForSceneKeyElement,
  legacyBlockKeyForElement,
} from './layoutTargetClassification';
import type { LayoutTarget } from './layoutTypes';

const legacyLayoutTargetSelector = 'table, pre, .mermaid-block, .math-block';

export function collectLayoutTargets(root: ParentNode): LayoutTarget[] {
  const targets: LayoutTarget[] = [];
  const imageCounts = new Map<string, number>();
  const genericCounts = new Map<string, number>();
  const collected = new Set<HTMLElement>();

  root.querySelectorAll<HTMLElement>('[data-preview-box-kind]').forEach((element) => {
    if (!canCollectLayoutElement(element, collected)) return;

    const blockKind = blockKindForPreviewBox(element);
    if (!blockKind) return;
    appendLayoutTarget(targets, collected, imageCounts, genericCounts, element, blockKind);
  });

  root.querySelectorAll<HTMLElement>('[data-preview-box-key]').forEach((element) => {
    if (!canCollectLayoutElement(element, collected)) return;

    const blockKind = blockKindForSceneKeyElement(element);
    if (!blockKind) return;
    appendLayoutTarget(targets, collected, imageCounts, genericCounts, element, blockKind);
  });

  root.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    if (!canCollectLayoutElement(image, collected)) return;

    appendLayoutTarget(targets, collected, imageCounts, genericCounts, image, 'image');
  });

  root.querySelectorAll<HTMLElement>(legacyLayoutTargetSelector).forEach((element) => {
    if (!canCollectLayoutElement(element, collected)) return;

    const blockKind = blockKindForLegacyElement(element);
    if (!blockKind) return;
    appendLayoutTarget(targets, collected, imageCounts, genericCounts, element, blockKind);
  });

  return targets;
}

export function layoutTargetFromElement(
  element: HTMLElement,
  blockKind: BlockKind,
  legacyBlockKey: string,
  legacyOccurrenceIndex: number,
): LayoutTarget {
  const match = layoutIdentityMatchForElement({
    element,
    blockKind,
    legacyBlockKey,
    legacyOccurrenceIndex,
  });

  return {
    element,
    blockKind: match.current.blockKind,
    blockKey: match.current.blockKey,
    occurrenceIndex: match.current.occurrenceIndex,
    legacyBlockKey: match.legacy?.blockKey ?? null,
    legacyOccurrenceIndex: match.legacy?.occurrenceIndex ?? null,
  };
}

export function ensureLayoutWrapper(target: LayoutTarget): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `preview-layout-block preview-${target.blockKind}-layout`;
  applyLayoutTargetDataset(wrapper, target);

  const parent = target.element.parentElement;
  const sourceElement = target.blockKind === 'image' && parent?.tagName === 'P' ? parent : target.element;
  copySourceLineDataset(sourceElement, wrapper);

  if (target.blockKind === 'image' && parent?.tagName === 'P' && isSingleImageParagraph(parent)) {
    parent.replaceWith(wrapper);
  } else {
    target.element.replaceWith(wrapper);
  }

  const surface = document.createElement('div');
  surface.className = 'preview-layout-surface';
  surface.append(target.element);
  wrapper.append(surface);
  return wrapper;
}

export function applyLayoutTargetDataset(wrapper: HTMLElement, target: LayoutTarget): void {
  wrapper.dataset.blockKind = target.blockKind;
  wrapper.dataset.blockKey = target.blockKey;
  wrapper.dataset.occurrenceIndex = String(target.occurrenceIndex);
  if (target.legacyBlockKey !== null && target.legacyOccurrenceIndex !== null) {
    wrapper.dataset.legacyBlockKey = target.legacyBlockKey;
    wrapper.dataset.legacyOccurrenceIndex = String(target.legacyOccurrenceIndex);
  } else {
    delete wrapper.dataset.legacyBlockKey;
    delete wrapper.dataset.legacyOccurrenceIndex;
  }
}

export function ensureLayoutSurface(wrapper: HTMLElement): HTMLElement {
  const existing = wrapper.querySelector<HTMLElement>(':scope > .preview-layout-surface');
  if (existing) return existing;

  const surface = document.createElement('div');
  surface.className = 'preview-layout-surface';
  Array.from(wrapper.childNodes).forEach((node) => {
    if (isLayoutInteractionChromeNode(node)) return;
    surface.append(node);
  });
  wrapper.prepend(surface);
  return surface;
}

export function replaceLayoutSurfaceContent(surface: HTMLElement, source: HTMLElement, blockKind: BlockKind): void {
  const reusableContent = reusableSurfaceContent(surface, source, blockKind);
  if (!reusableContent) {
    surface.replaceChildren(source);
    return;
  }

  syncElementAttributes(reusableContent, source);
  reusableContent.replaceChildren(...Array.from(source.childNodes));
}

function appendLayoutTarget(
  targets: LayoutTarget[],
  collected: Set<HTMLElement>,
  imageCounts: Map<string, number>,
  genericCounts: Map<string, number>,
  element: HTMLElement,
  blockKind: BlockKind,
): void {
  const legacyBlockKey = legacyBlockKeyForElement(element, blockKind);
  const countKey = blockKind === 'image' ? legacyBlockKey : `${blockKind}:${legacyBlockKey}`;
  const legacyOccurrenceIndex = nextOccurrence(blockKind === 'image' ? imageCounts : genericCounts, countKey);

  targets.push(layoutTargetFromElement(element, blockKind, legacyBlockKey, legacyOccurrenceIndex));
  collected.add(element);
}

function canCollectLayoutElement(element: HTMLElement, collected: Set<HTMLElement>): boolean {
  if (element.closest('.preview-layout-block, .pending-image-block, .failed-image-block')) return false;
  if (element.classList.contains('mermaid-block') && !element.querySelector('svg')) return false;
  return !overlapsCollectedTarget(element, collected);
}

function overlapsCollectedTarget(element: HTMLElement, collected: Set<HTMLElement>): boolean {
  for (const target of collected) {
    if (target === element || target.contains(element) || element.contains(target)) return true;
  }
  return false;
}

function nextOccurrence(counts: Map<string, number>, key: string): number {
  const next = counts.get(key) ?? 0;
  counts.set(key, next + 1);
  return next;
}

function reusableSurfaceContent(surface: HTMLElement, source: HTMLElement, blockKind: BlockKind): HTMLElement | null {
  const current = surface.firstElementChild;
  if (!(current instanceof HTMLElement)) return null;

  if (blockKind === 'code') {
    return current.tagName === 'PRE' && source.tagName === 'PRE' ? current : null;
  }

  if (blockKind === 'table') {
    return current.tagName === 'TABLE' && source.tagName === 'TABLE' ? current : null;
  }

  if (blockKind === 'mermaid') {
    return current.classList.contains('mermaid-block') && source.classList.contains('mermaid-block') ? current : null;
  }

  if (blockKind === 'katex') {
    return current.classList.contains('math-block') && source.classList.contains('math-block') ? current : null;
  }

  return null;
}

function syncElementAttributes(target: HTMLElement, source: HTMLElement): void {
  Array.from(target.attributes).forEach((attribute) => {
    if (!source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
  });
  Array.from(source.attributes).forEach((attribute) => {
    target.setAttribute(attribute.name, attribute.value);
  });
}
