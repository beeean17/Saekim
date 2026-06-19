import { createPreviewSurfaceAdapter } from '../../core/preview/surfacePolicy';

export const androidPreviewSurface = createPreviewSurfaceAdapter({
  target: 'android',
  surfaceKind: 'dom-backed-canvas',
  policy: {
    defaultInteractionMode: 'view',
    supportedInteractionModes: ['view', 'arrange'],
    defaultFlow: 'document-flow',
    render: {
      maxMountedBoxes: 80,
      maxInteractiveBoxes: 50,
      overscanPx: 560,
      debounceMs: 220,
    },
    pointer: {
      resizeHandlePx: 18,
      dragActivationPx: 8,
      longPressArrangeMs: 450,
      commitBoundsOnPointerUp: true,
    },
  },
});
