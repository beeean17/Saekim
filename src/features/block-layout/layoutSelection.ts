import type { BlockKind } from '../../types/metadata';
import { isPreviewArrangeMode } from './interactionMode';
import { blockKindFromDataset } from './layoutDom';

export function bindLayoutSelection(root: HTMLElement, wrapper: HTMLElement): void {
  if (!root.dataset.layoutSelectionBound) {
    root.dataset.layoutSelectionBound = 'true';
    root.addEventListener('click', (event) => {
      if (!isPreviewArrangeMode(root)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.preview-layout-block')) return;
      clearSelectedLayoutBlocks(root);
      clearSelectedKatexEquations(root);
    });
  }

  if (wrapper.dataset.layoutSelectionBound) return;
  wrapper.dataset.layoutSelectionBound = 'true';
  wrapper.addEventListener('click', (event) => {
    if (!isPreviewArrangeMode(root)) return;
    const target = event.target;
    if (target instanceof Element && target.closest('.preview-layout-tools')) return;
    if (!(target instanceof Element) || !isLayoutSelectionTarget(wrapper, target)) {
      clearSelectedLayoutBlocks(root);
      clearSelectedKatexEquations(root);
      return;
    }

    clearSelectedLayoutBlocks(root);
    wrapper.dataset.selected = 'true';
    if (!target.closest('.math-equation')) {
      clearSelectedKatexEquations(root);
    }
  });
}

export function clearSelectedLayoutBlocks(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.preview-layout-block[data-selected="true"]').forEach((item) => {
    delete item.dataset.selected;
  });
}

export function clearSelectedKatexEquations(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.math-equation[data-selected="true"]').forEach((item) => {
    delete item.dataset.selected;
  });
}

function isLayoutSelectionTarget(wrapper: HTMLElement, target: Element): boolean {
  const surface = wrapper.querySelector<HTMLElement>(':scope > .preview-layout-surface');
  if (!surface || !surface.contains(target)) return false;

  const blockKind = blockKindFromDataset(wrapper.dataset.blockKind);
  const selector = blockKind ? selectorForBlockKind(blockKind) : null;
  if (!selector) return false;

  const selected = target.closest<HTMLElement>(selector);
  return Boolean(selected && surface.contains(selected));
}

function selectorForBlockKind(blockKind: BlockKind): string | null {
  if (blockKind === 'text') return 'p, h1, h2, h3, h4, h5, h6';
  if (blockKind === 'image') return 'img';
  if (blockKind === 'table') return 'table';
  if (blockKind === 'list') return 'ul, ol';
  if (blockKind === 'blockquote') return 'blockquote';
  if (blockKind === 'code') return 'pre, .shiki, code';
  if (blockKind === 'mermaid') return '.mermaid-block';
  if (blockKind === 'katex') return '.math-block';
  return null;
}
