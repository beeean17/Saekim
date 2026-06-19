export interface LayoutInteractionPolicy {
  readonly dragActivationPx: number;
  readonly longPressArrangeMs: number | null;
  readonly resizeHandlePx: number;
}

const fallbackInteractionPolicy: LayoutInteractionPolicy = {
  dragActivationPx: 4,
  longPressArrangeMs: null,
  resizeHandlePx: 12,
};

export function layoutInteractionPolicyFromRoot(root: HTMLElement): LayoutInteractionPolicy {
  return {
    dragActivationPx: numberDatasetValue(root.dataset.previewDragActivationPx, fallbackInteractionPolicy.dragActivationPx),
    longPressArrangeMs: nullableNumberDatasetValue(root.dataset.previewLongPressArrangeMs),
    resizeHandlePx: numberDatasetValue(root.dataset.previewResizeHandlePx, fallbackInteractionPolicy.resizeHandlePx),
  };
}

function numberDatasetValue(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function nullableNumberDatasetValue(value: string | undefined): number | null {
  if (!value) return fallbackInteractionPolicy.longPressArrangeMs;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackInteractionPolicy.longPressArrangeMs;
}
