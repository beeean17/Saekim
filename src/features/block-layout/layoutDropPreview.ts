import { layoutUngroupSlotClass } from './interactionMode';
import { getLayoutWrappers } from './layoutDom';

export function updateLayoutDropPreview(
  root: HTMLElement,
  source: HTMLElement,
  clientX: number,
  clientY: number,
  canUngroup: boolean,
): void {
  const target = layoutDropTargetFromPoint(root, source, clientX, clientY);
  clearLayoutDropTargets(root, target ?? undefined);

  if (target) {
    setLayoutDropPreviewMetrics(source, target);
    target.dataset.dropPosition = 'right';
    return;
  }

  if (canUngroup) {
    renderLayoutUngroupSlot(root, source);
  }
}

export function layoutDropTargetFromPoint(
  root: HTMLElement,
  source: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const candidates = getLayoutWrappers(root).filter((item) => item !== source);
  let best: { readonly wrapper: HTMLElement; readonly score: number } | null = null;

  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const zoneWidth = rightDropZoneWidth(rect);
    const withinX = clientX >= rect.right - zoneWidth && clientX <= rect.right + 36;
    const withinY = clientY >= rect.top - 12 && clientY <= rect.bottom + 12;
    if (!withinX || !withinY) continue;

    const verticalDistance =
      clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const score = Math.abs(rect.right - clientX) + verticalDistance * 2;
    if (!best || score < best.score) best = { wrapper: candidate, score };
  }

  return best?.wrapper ?? null;
}

export function currentLayoutDropTarget(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('.preview-layout-block[data-drop-position="right"]');
}

export function isRightEdgeDrop(wrapper: HTMLElement, event: DragEvent): boolean {
  const rect = wrapper.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const zoneWidth = rightDropZoneWidth(rect);
  return event.clientX >= rect.right - zoneWidth && event.clientX <= rect.right + 24;
}

export function clearLayoutDropTargets(root: HTMLElement, except?: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.preview-layout-block[data-drop-position]').forEach((item) => {
    if (item !== except) {
      delete item.dataset.dropPosition;
      item.style.removeProperty('--preview-drop-height');
    }
  });
  root.querySelectorAll(`.${layoutUngroupSlotClass}`).forEach((node) => node.remove());
}

function setLayoutDropPreviewMetrics(source: HTMLElement, target: HTMLElement): void {
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const height = Math.max(72, Math.min(420, sourceRect.height || targetRect.height));
  target.style.setProperty('--preview-drop-height', `${Math.round(height)}px`);
}

function renderLayoutUngroupSlot(root: HTMLElement, source: HTMLElement): void {
  if (!isGroupedLayoutWrapper(source)) return;

  const group = source.closest<HTMLElement>('.preview-layout-group');
  if (!group || !root.contains(group)) return;

  const slot = document.createElement('div');
  slot.className = layoutUngroupSlotClass;
  slot.setAttribute('aria-hidden', 'true');
  slot.style.setProperty('--preview-ungroup-height', `${previewSlotHeight(source)}px`);

  if (layoutGroupIndexFromDataset(source) <= 0) {
    group.before(slot);
  } else {
    group.after(slot);
  }
}

function isGroupedLayoutWrapper(wrapper: HTMLElement): boolean {
  const groupColumns = Number.parseInt(wrapper.dataset.groupColumns ?? '1', 10);
  return Boolean(wrapper.dataset.groupId && Number.isFinite(groupColumns) && groupColumns > 1);
}

function layoutGroupIndexFromDataset(wrapper: HTMLElement): number {
  const groupIndex = Number.parseInt(wrapper.dataset.groupIndex ?? '0', 10);
  return Number.isFinite(groupIndex) ? groupIndex : 0;
}

function previewSlotHeight(source: HTMLElement): number {
  const sourceRect = source.getBoundingClientRect();
  return Math.round(Math.max(72, Math.min(420, sourceRect.height)));
}

function rightDropZoneWidth(rect: DOMRect): number {
  return Math.min(180, Math.max(64, rect.width * 0.32));
}
