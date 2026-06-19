import { androidPreviewSurface } from '../android/previewSurface';
import { browserPreviewSurface } from '../browser/previewSurface';
import { desktopPreviewSurface } from '../desktop/previewSurface';
import { isAndroidRuntime } from './runtime';
import { isTauriRuntime } from './tauri/invoke';

export const PreviewSurface = isAndroidRuntime()
  ? androidPreviewSurface
  : isTauriRuntime()
    ? desktopPreviewSurface
    : browserPreviewSurface;

export type {
  PreviewInteractionMode,
  PreviewRenderBudget,
  PreviewRuntimeTarget,
  PreviewSurfaceAdapter,
  PreviewSurfaceKind,
  PreviewSurfacePolicy,
} from '../../core/preview/surfacePolicy';
