import { createPreviewSurfaceAdapter } from '../../core/preview/surfacePolicy';

export const desktopPreviewSurface = createPreviewSurfaceAdapter({
  target: 'desktop',
  surfaceKind: 'dom-backed-canvas',
  policy: {
    defaultInteractionMode: 'view',
    supportedInteractionModes: ['view', 'arrange'],
    defaultFlow: 'document-flow',
    render: {
      maxMountedBoxes: 240,
      maxInteractiveBoxes: 160,
      overscanPx: 1200,
      debounceMs: 250,
    },
    pointer: {
      resizeHandlePx: 10,
      dragActivationPx: 3,
      longPressArrangeMs: null,
      commitBoundsOnPointerUp: true,
    },
  },
});
