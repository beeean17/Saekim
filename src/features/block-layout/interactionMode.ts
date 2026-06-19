import type { PreviewInteractionMode } from '../../core/preview/surfacePolicy';

const arrangeMode: PreviewInteractionMode = 'arrange';
export const layoutUngroupSlotClass = 'preview-layout-ungroup-slot';

export function isPreviewArrangeMode(root: HTMLElement): boolean {
  return root.dataset.previewInteractionMode === arrangeMode;
}

export function isLayoutInteractionChromeNode(node: ChildNode): boolean {
  return (
    node instanceof HTMLElement &&
    (node.classList.contains('preview-layout-tools') ||
      node.classList.contains('preview-layout-drop-zone') ||
      node.classList.contains(layoutUngroupSlotClass) ||
      node.classList.contains('preview-image-resize-handle') ||
      node.classList.contains('math-equation-tools'))
  );
}

export function removeLayoutInteractionChrome(scope: ParentNode): void {
  scope.querySelectorAll('.preview-layout-tools').forEach((node) => node.remove());
  scope.querySelectorAll('.preview-layout-drop-zone').forEach((node) => node.remove());
  scope.querySelectorAll(`.${layoutUngroupSlotClass}`).forEach((node) => node.remove());
  scope.querySelectorAll('.preview-image-resize-handle').forEach((node) => node.remove());
  scope.querySelectorAll('.math-equation-tools').forEach((node) => node.remove());
}

export function clearLayoutInteractionState(root: HTMLElement): void {
  delete root.dataset.layoutDragging;
  root.querySelectorAll<HTMLElement>('.preview-layout-block').forEach((wrapper) => {
    delete wrapper.dataset.selected;
    delete wrapper.dataset.dragging;
    delete wrapper.dataset.resizing;
    delete wrapper.dataset.dropPosition;
    wrapper.style.removeProperty('--preview-drop-height');
  });
  root.querySelectorAll<HTMLElement>('.math-equation[data-selected="true"]').forEach((equation) => {
    delete equation.dataset.selected;
  });
  root.querySelectorAll(`.${layoutUngroupSlotClass}`).forEach((node) => node.remove());
}
