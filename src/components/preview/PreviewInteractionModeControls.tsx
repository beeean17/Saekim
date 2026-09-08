import type { PreviewInteractionMode } from '../../core/preview/surfacePolicy';
import { PreviewSurface } from '../../platform/common/previewSurface';
import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';
import { ToolbarButton } from '../ui/toolbar/Toolbar';
import { useI18n } from '../../i18n/useI18n';

interface PreviewInteractionModeControlsProps {
  readonly disabled: boolean;
}

export function PreviewInteractionModeControls({ disabled }: PreviewInteractionModeControlsProps) {
  const { t } = useI18n();
  const previewInteractionMode = useUIStore((state) => state.previewInteractionMode);
  const setPreviewInteractionMode = useUIStore((state) => state.setPreviewInteractionMode);

  if (PreviewSurface.policy.supportedInteractionModes.length < 2) return null;

  return (
    <div className="preview-mode-actions" role="group" aria-label={t('preview.interactionMode')}>
      {previewModeOptions(t).map((option) => {
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

function previewModeOptions(t: ReturnType<typeof useI18n>['t']) {
  return [
    { mode: 'view', icon: 'eye', title: t('preview.view') },
    { mode: 'arrange', icon: 'edit', title: t('preview.arrange') },
  ] as const satisfies readonly {
    readonly mode: PreviewInteractionMode;
    readonly icon: 'eye' | 'edit';
    readonly title: string;
  }[];
}
