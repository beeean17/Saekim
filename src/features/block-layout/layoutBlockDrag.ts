import type { BlockLayout } from '../../types/metadata';
import { isPreviewArrangeMode } from './interactionMode';
import { layoutIdentity } from './layoutIdentity';
import {
  clearLayoutDropTargets,
  currentLayoutDropTarget,
  isRightEdgeDrop,
  layoutDropTargetFromPoint,
  updateLayoutDropPreview,
} from './layoutDropPreview';
import {
  clearLayoutGroup,
  findLayoutWrapperByIdentity,
  getLayoutGroupColumns,
  getLayoutGroupId,
  groupLayoutsForWrapper,
  layoutForWrapper,
  uniqueLayouts,
  withColumnGroup,
} from './layoutModel';
import type { LayoutInteractionPolicy } from './layoutInteractionPolicy';
import { clearSelectedKatexEquations, clearSelectedLayoutBlocks } from './layoutSelection';
import type { LayoutByKey, LayoutChangeHandler } from './layoutTypes';

const layoutUngroupThresholdPx = 18;

type ActiveLayoutDrag = {
  readonly filePath: string;
  readonly identity: string;
  readonly source: HTMLElement;
};

let activeLayoutDrag: ActiveLayoutDrag | null = null;

export function clearActiveLayoutDrag(): void {
  activeLayoutDrag = null;
}

export function startLayoutPointerDrag(
  event: PointerEvent,
  handle: HTMLElement,
  wrapper: HTMLElement,
  root: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
  onChange: LayoutChangeHandler,
  interactionPolicy: LayoutInteractionPolicy,
): void {
  if (event.button !== 0 || !isPreviewArrangeMode(root)) return;

  event.preventDefault();
  event.stopPropagation();

  const identity = layoutIdentity(layoutForWrapper(wrapper, filePath, layoutByKey));
  const startX = event.clientX;
  const startY = event.clientY;
  let dragArmed = false;
  let started = false;
  let longPressTimer: number | null = null;

  const clearLongPressTimer = () => {
    if (longPressTimer === null) return;
    window.clearTimeout(longPressTimer);
    longPressTimer = null;
  };

  const armDrag = () => {
    if (dragArmed) return;

    dragArmed = true;
    activeLayoutDrag = { filePath, identity, source: wrapper };
    clearSelectedLayoutBlocks(root);
    clearSelectedKatexEquations(root);
    wrapper.dataset.selected = 'true';
    wrapper.dataset.dragging = 'true';
    delete wrapper.dataset.dragPending;
  };

  if (interactionPolicy.longPressArrangeMs === null) {
    armDrag();
  } else {
    wrapper.dataset.dragPending = 'true';
    longPressTimer = window.setTimeout(armDrag, interactionPolicy.longPressArrangeMs);
  }

  handle.setPointerCapture(event.pointerId);

  const handlePointerMove = (moveEvent: PointerEvent) => {
    moveEvent.preventDefault();

    const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
    if (!dragArmed) {
      if (distance >= interactionPolicy.dragActivationPx) cancelPointerDrag(moveEvent);
      return;
    }

    if (!started && distance < interactionPolicy.dragActivationPx) return;

    started = true;
    root.dataset.layoutDragging = 'true';
    updateLayoutDropPreview(root, wrapper, moveEvent.clientX, moveEvent.clientY, distance >= layoutUngroupThresholdPx);
  };

  const finishPointerDrag = (finishEvent: PointerEvent) => {
    if (handle.hasPointerCapture(finishEvent.pointerId)) handle.releasePointerCapture(finishEvent.pointerId);
    handle.removeEventListener('pointermove', handlePointerMove);
    handle.removeEventListener('pointerup', finishPointerDrag);
    handle.removeEventListener('pointercancel', cancelPointerDrag);
    clearLongPressTimer();

    const distance = Math.hypot(finishEvent.clientX - startX, finishEvent.clientY - startY);
    const target = currentLayoutDropTarget(root) ?? layoutDropTargetFromPoint(root, wrapper, finishEvent.clientX, finishEvent.clientY);
    if (started && target && canDropLayoutBlock(root, target, filePath)) {
      createManualTwoColumnGroup(root, wrapper, target, filePath, layoutByKey, onChange);
    } else if (started && distance >= layoutUngroupThresholdPx) {
      clearLayoutGroupForWrapper(root, wrapper, filePath, layoutByKey, onChange);
    }

    finishLayoutDrag(root, wrapper);
  };

  const cancelPointerDrag = (cancelEvent: PointerEvent) => {
    if (handle.hasPointerCapture(cancelEvent.pointerId)) handle.releasePointerCapture(cancelEvent.pointerId);
    handle.removeEventListener('pointermove', handlePointerMove);
    handle.removeEventListener('pointerup', finishPointerDrag);
    handle.removeEventListener('pointercancel', cancelPointerDrag);
    clearLongPressTimer();
    finishLayoutDrag(root, wrapper);
  };

  handle.addEventListener('pointermove', handlePointerMove);
  handle.addEventListener('pointerup', finishPointerDrag);
  handle.addEventListener('pointercancel', cancelPointerDrag);
}

export function bindLayoutDropTarget(
  root: HTMLElement,
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
  onChange: LayoutChangeHandler,
): void {
  wrapper.ondragover = (event) => {
    if (!isPreviewArrangeMode(root) || !canDropLayoutBlock(root, wrapper, filePath)) {
      delete wrapper.dataset.dropPosition;
      return;
    }

    if (!isRightEdgeDrop(wrapper, event)) {
      delete wrapper.dataset.dropPosition;
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    clearLayoutDropTargets(root, wrapper);
    wrapper.dataset.dropPosition = 'right';
  };

  wrapper.ondragleave = (event) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && wrapper.contains(relatedTarget)) return;
    delete wrapper.dataset.dropPosition;
  };

  wrapper.ondrop = (event) => {
    if (!isPreviewArrangeMode(root) || !canDropLayoutBlock(root, wrapper, filePath)) {
      delete wrapper.dataset.dropPosition;
      return;
    }

    if (!isRightEdgeDrop(wrapper, event) && wrapper.dataset.dropPosition !== 'right') return;

    const source = findLayoutWrapperByIdentity(root, activeLayoutDrag?.identity ?? '');
    if (!source || source === wrapper) return;

    event.preventDefault();
    createManualTwoColumnGroup(root, source, wrapper, filePath, layoutByKey, onChange);
    activeLayoutDrag = null;
    delete root.dataset.layoutDragging;
    delete source.dataset.dragging;
    clearLayoutDropTargets(root);
  };
}

function finishLayoutDrag(root: HTMLElement, source: HTMLElement): void {
  activeLayoutDrag = null;
  delete root.dataset.layoutDragging;
  delete source.dataset.dragging;
  delete source.dataset.dragPending;
  clearLayoutDropTargets(root);
}

function canDropLayoutBlock(root: HTMLElement, target: HTMLElement, filePath: string): boolean {
  if (!isPreviewArrangeMode(root) || !activeLayoutDrag || activeLayoutDrag.filePath !== filePath) return false;
  const source = activeLayoutDrag.source.isConnected
    ? activeLayoutDrag.source
    : findLayoutWrapperByIdentity(root, activeLayoutDrag.identity);
  return Boolean(source && source !== target);
}

function createManualTwoColumnGroup(
  root: HTMLElement,
  source: HTMLElement,
  target: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
  onChange: LayoutChangeHandler,
): void {
  const sourceLayout = layoutForWrapper(source, filePath, layoutByKey);
  const targetLayout = layoutForWrapper(target, filePath, layoutByKey);
  const sourceIdentity = layoutIdentity(sourceLayout);
  const targetIdentity = layoutIdentity(targetLayout);
  if (sourceIdentity === targetIdentity) return;

  const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const previousLayouts = uniqueLayouts([
    ...groupLayoutsForWrapper(root, source, filePath, layoutByKey),
    ...groupLayoutsForWrapper(root, target, filePath, layoutByKey),
  ]);

  const clearedPreviousLayouts = previousLayouts
    .filter((item) => {
      const identity = layoutIdentity(item);
      return identity !== sourceIdentity && identity !== targetIdentity;
    })
    .map((item) => clearLayoutGroup({ ...item, widthValue: 100, widthUnit: '%' }));

  onChange([
    ...clearedPreviousLayouts,
    withColumnGroup(clearLayoutGroup(targetLayout), groupId, 2, 0, 'manual'),
    withColumnGroup(clearLayoutGroup(sourceLayout), groupId, 2, 1, 'manual'),
  ]);
}

function clearLayoutGroupForWrapper(
  root: HTMLElement,
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
  onChange: LayoutChangeHandler,
): void {
  const layout = layoutForWrapper(wrapper, filePath, layoutByKey);
  if (!getLayoutGroupId(layout) || getLayoutGroupColumns(layout) <= 1) return;

  onChange(
    groupLayoutsForWrapper(root, wrapper, filePath, layoutByKey).map((item) =>
      clearLayoutGroup({ ...item, widthValue: 100, widthUnit: '%' }),
    ),
  );
}
