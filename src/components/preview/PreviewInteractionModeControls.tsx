import type { PreviewInteractionMode } from '../../core/preview/surfacePolicy';
import { PreviewSurface } from '../../platform/common/previewSurface';
import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';
import { ToolbarButton } from '../ui/toolbar/Toolbar';

interface PreviewInteractionModeControlsProps {
  readonly disabled: boolean;
}

const previewModeOptions = [
  { mode: 'view', icon: 'eye', title: '일반 보기' },
  { mode: 'arrange', icon: 'edit', title: '재배치 및 리사이즈' },
] as const satisfies readonly {
  readonly mode: PreviewInteractionMode;
  readonly icon: 'eye' | 'edit';
  readonly title: string;
}[];

export function PreviewInteractionModeControls({ disabled }: PreviewInteractionModeControlsProps) {
  const previewInteractionMode = useUIStore((state) => state.previewInteractionMode);
  const setPreviewInteractionMode = useUIStore((state) => state.setPreviewInteractionMode);

  if (PreviewSurface.policy.supportedInteractionModes.length < 2) return null;

  return (
    <div className="preview-mode-actions" role="group" aria-label="미리보기 조작 모드">
      {previewModeOptions.map((option) => {
        const isActive = previewInteractionMode === option.mode;
        const isSupported = PreviewSurface.policy.supportedInteractionModes.includes(option.mode);
        return (
          <ToolbarButton
            aria-pressed={isActive}
            className={`preview-action ${isActive ? 'active' : ''}`}
            disabled={disabled || !isSupported}
            key={option.mode}
            title={option.title}
            onClick={() => setPreviewInteractionMode(option.mode)}
          >
            <Icon name={option.icon} />
          </ToolbarButton>
        );
      })}
    </div>
  );
}
