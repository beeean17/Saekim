import type { BlockLayout, LayoutAlign } from '../../types/metadata';
import { isPreviewArrangeMode } from './interactionMode';
import { blockKindFromDataset } from './layoutDom';
import { getKatexEquationAlignments, withKatexEquationAlign } from './layoutModel';
import { clearSelectedKatexEquations, clearSelectedLayoutBlocks } from './layoutSelection';
import type { LayoutChangeHandler } from './layoutTypes';
import { translateCurrent } from '../../i18n/current';

const equationAligns: readonly LayoutAlign[] = ['left', 'center', 'right'];

export function renderKatexEquationControls(
  wrapper: HTMLElement,
  layout: BlockLayout,
  root: HTMLElement,
  onChange: LayoutChangeHandler,
): void {
  if (blockKindFromDataset(wrapper.dataset.blockKind) !== 'katex') return;

  const equations = Array.from(wrapper.querySelectorAll<HTMLElement>('.math-equation'));
  if (equations.length === 0) return;

  const alignments = getKatexEquationAlignments(layout);

  equations.forEach((equation, index) => {
    const key = equation.dataset.equationKey || String(index);
    const currentAlign = alignments[key] ?? 'center';
    equation.dataset.align = currentAlign;
    equation.querySelector('.math-equation-tools')?.remove();

    if (!equation.dataset.equationSelectionBound) {
      equation.dataset.equationSelectionBound = 'true';
      equation.addEventListener('click', (event) => {
        if (!isPreviewArrangeMode(root)) return;
        const target = event.target;
        if (target instanceof Element && target.closest('.math-equation-tools')) return;

        clearSelectedKatexEquations(root);
        equation.dataset.selected = 'true';
      });
    }

    const tools = document.createElement('div');
    tools.className = 'math-equation-tools';
    tools.setAttribute('aria-label', translateCurrent('layout.formulaAlign'));
    tools.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    equationAligns.forEach((align) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = align === 'left' ? 'L' : align === 'center' ? 'C' : 'R';
      button.title = translateCurrent(align === 'left' ? 'layout.formulaLeft' : align === 'center' ? 'layout.formulaCenter' : 'layout.formulaRight');
      button.className = currentAlign === align ? 'active' : '';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearSelectedLayoutBlocks(root);
        clearSelectedKatexEquations(root);
        wrapper.dataset.selected = 'true';
        equation.dataset.selected = 'true';
        equation.dataset.align = align;
        onChange(withKatexEquationAlign(layout, key, align));
      });
      tools.append(button);
    });

    equation.append(tools);
  });
}
