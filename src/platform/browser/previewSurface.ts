import { createPreviewSurfaceAdapter } from '../../core/preview/surfacePolicy';

export const browserPreviewSurface = createPreviewSurfaceAdapter({
  target: 'browser',
  surfaceKind: 'dom-backed-canvas',
  policy: {
    defaultInteractionMode: 'view',
    supportedInteractionModes: ['view', 'arrange'],
    defaultFlow: 'document-flow',
    render: {
      maxMountedBoxes: 160,
      maxInteractiveBoxes: 100,
      overscanPx: 900,
      debounceMs: 180,
    },
    pointer: {
      resizeHandlePx: 12,
      dragActivationPx: 4,
      longPressArrangeMs: null,
      commitBoundsOnPointerUp: true,
    },
  },
});
