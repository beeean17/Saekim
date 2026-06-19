import type { PreviewBoxFlow } from './renderObjectTypes';

export const PREVIEW_INTERACTION_MODES = ['view', 'arrange'] as const;
export type PreviewInteractionMode = (typeof PREVIEW_INTERACTION_MODES)[number];

export const PREVIEW_SURFACE_KINDS = ['dom-backed-canvas'] as const;
export type PreviewSurfaceKind = (typeof PREVIEW_SURFACE_KINDS)[number];

export const PREVIEW_RUNTIME_TARGETS = ['desktop', 'android', 'browser'] as const;
export type PreviewRuntimeTarget = (typeof PREVIEW_RUNTIME_TARGETS)[number];

export interface PreviewRenderBudget {
  readonly maxMountedBoxes: number;
  readonly maxInteractiveBoxes: number;
  readonly overscanPx: number;
  readonly debounceMs: number;
}

export interface PreviewPointerPolicy {
  readonly resizeHandlePx: number;
  readonly dragActivationPx: number;
  readonly longPressArrangeMs: number | null;
  readonly commitBoundsOnPointerUp: boolean;
}

export interface PreviewSurfacePolicy {
  readonly defaultInteractionMode: PreviewInteractionMode;
  readonly supportedInteractionModes: readonly PreviewInteractionMode[];
  readonly defaultFlow: PreviewBoxFlow;
  readonly render: PreviewRenderBudget;
  readonly pointer: PreviewPointerPolicy;
}

export interface PreviewSurfaceAdapter {
  readonly target: PreviewRuntimeTarget;
  readonly surfaceKind: PreviewSurfaceKind;
  readonly policy: PreviewSurfacePolicy;
}

export function createPreviewSurfaceAdapter(adapter: PreviewSurfaceAdapter): PreviewSurfaceAdapter {
  return adapter;
}
