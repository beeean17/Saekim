import type { CSSProperties, ReactNode } from 'react';
import type { PreviewInteractionMode } from '../../core/preview/surfacePolicy';
import { PreviewSurface } from '../../platform/common/previewSurface';

interface PreviewSurfaceRootProps {
  readonly className: string;
  readonly interactionMode: PreviewInteractionMode;
  readonly onMount: (element: HTMLDivElement | null) => void;
  readonly children?: ReactNode;
}

interface PreviewSurfaceStyle extends CSSProperties {
  readonly '--preview-image-resize-handle-px': string;
}

export function PreviewSurfaceRoot({ className, interactionMode, onMount, children }: PreviewSurfaceRootProps) {
  const pointerPolicy = PreviewSurface.policy.pointer;
  const style: PreviewSurfaceStyle = {
    '--preview-image-resize-handle-px': `${pointerPolicy.resizeHandlePx}px`,
  };

  return (
    <div
      className={className}
      data-preview-drag-activation-px={pointerPolicy.dragActivationPx}
      data-preview-interaction-mode={interactionMode}
      data-preview-long-press-arrange-ms={pointerPolicy.longPressArrangeMs ?? undefined}
      data-preview-max-mounted-boxes={PreviewSurface.policy.render.maxMountedBoxes}
      data-preview-runtime={PreviewSurface.target}
      data-preview-resize-handle-px={pointerPolicy.resizeHandlePx}
      data-preview-surface={PreviewSurface.surfaceKind}
      ref={onMount}
      style={style}
    >
      {children}
    </div>
  );
}
