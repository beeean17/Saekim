import type { PreviewContribution } from '../../app/feature';

const selectionLineClass = 'code-selection-line';
const selectionBlockClass = 'has-code-selection';
const codeBlockSelectionCleanups = new WeakMap<HTMLElement, () => void>();

export const codeBlockSelectionPreviewEnhancement: PreviewContribution = {
  id: 'preview-dom.code-block-selection',
  priority: -69,
  match: () => true,
  afterRender(root) {
    cleanupCodeBlockSelection(root);

    const blocks = codeBlocks(root);
    if (blocks.length === 0) return;

    let animationFrame: number | null = null;
    const syncSelection = () => {
      if (animationFrame !== null) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        syncCodeBlockSelection(blocks);
      });
    };

    document.addEventListener('selectionchange', syncSelection);
    root.addEventListener('pointerup', syncSelection);
    root.addEventListener('keyup', syncSelection);
    syncSelection();

    codeBlockSelectionCleanups.set(root, () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('selectionchange', syncSelection);
      root.removeEventListener('pointerup', syncSelection);
      root.removeEventListener('keyup', syncSelection);
      clearCodeBlockSelection(blocks);
    });
  },
  cleanup(root) {
    cleanupCodeBlockSelection(root);
  },
};

function cleanupCodeBlockSelection(root: HTMLElement): void {
  codeBlockSelectionCleanups.get(root)?.();
  codeBlockSelectionCleanups.delete(root);
}

function codeBlocks(root: HTMLElement): readonly HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('pre.shiki')).filter((block) => linesInBlock(block).length > 0);
}

function syncCodeBlockSelection(blocks: readonly HTMLElement[]): void {
  const selection = document.getSelection();
  const ranges = selection && !selection.isCollapsed ? selectionRanges(selection) : [];

  if (ranges.length === 0) {
    clearCodeBlockSelection(blocks);
    return;
  }

  blocks.forEach((block) => syncSelectedLines(block, ranges));
}

function syncSelectedLines(block: HTMLElement, ranges: readonly Range[]): void {
  const lines = linesInBlock(block);
  const selectedLines = lines.map((line) => ranges.some((range) => range.intersectsNode(line)));
  const firstContentLine = selectedLines.findIndex((selected, index) => selected && hasSelectableText(lines[index]));
  let lastContentLine = -1;
  let hasSelectedLine = false;

  for (let index = selectedLines.length - 1; index >= 0; index -= 1) {
    if (selectedLines[index] === true && hasSelectableText(lines[index])) {
      lastContentLine = index;
      break;
    }
  }

  lines.forEach((line, index) => {
    const selected = firstContentLine !== -1 && index >= firstContentLine && index <= lastContentLine && selectedLines[index] === true;
    line.classList.toggle(selectionLineClass, selected);
    hasSelectedLine ||= selected;
  });

  block.classList.toggle(selectionBlockClass, hasSelectedLine);
}

function clearCodeBlockSelection(blocks: readonly HTMLElement[]): void {
  blocks.forEach((block) => {
    block.classList.remove(selectionBlockClass);
    linesInBlock(block).forEach((line) => line.classList.remove(selectionLineClass));
  });
}

function selectionRanges(selection: Selection): readonly Range[] {
  const ranges: Range[] = [];
  for (let index = 0; index < selection.rangeCount; index += 1) {
    ranges.push(selection.getRangeAt(index));
  }
  return ranges;
}

function linesInBlock(block: HTMLElement): readonly HTMLElement[] {
  return Array.from(block.querySelectorAll<HTMLElement>('code .line'));
}

function hasSelectableText(line: HTMLElement | undefined): boolean {
  return line?.textContent !== '';
}
