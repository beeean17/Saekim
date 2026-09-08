import type { MutableRefObject } from 'react';
import type { PreviewRenderContext } from '../../app/feature';
import { enabledFeatures } from '../../app/featureRegistry';
import { getFileTypeInfo } from '../../core/document/fileType';
import { selectPreviewRenderer } from '../../core/preview/registry';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { Icon } from '../primitives/Icon';
import { ToolbarButton } from '../ui/toolbar/Toolbar';
import { PreviewContent } from './PreviewContent';
import { PreviewInteractionModeControls } from './PreviewInteractionModeControls';
import { useI18n } from '../../i18n/useI18n';

interface PreviewPaneProps {
  readonly previewRef: MutableRefObject<HTMLDivElement | null>;
  readonly onPreviewElementChange: (element: HTMLDivElement | null) => void;
}

export function PreviewPane({ previewRef, onPreviewElementChange }: PreviewPaneProps) {
  const { t } = useI18n();
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const theme = useSettingsStore((state) => state.resolvedTheme);
  const htmlPreviewMode = useSettingsStore((state) => state.htmlPreviewMode);
  const setHtmlPreviewMode = useSettingsStore((state) => state.setHtmlPreviewMode);
  const fileType = getFileTypeInfo(activeFile?.name, activeFile?.path, enabledFeatures);
  const previewContext = activeFile
    ? ({ file: activeFile, fileType, theme, htmlPreviewMode, setHtmlPreviewMode } satisfies PreviewRenderContext)
    : null;
  const renderer = previewContext ? selectPreviewRenderer(enabledFeatures, previewContext) : null;

  return (
    <section className="preview-pane" data-disabled={!activeFile}>
      <div className="preview-head">
        <span className="label">{t('preview.title')}</span>
        {previewContext ? renderer?.head?.(previewContext) : null}
        <div className="preview-head-actions">
          <PreviewInteractionModeControls disabled={!activeFile} />
          <ToolbarButton
            className={`preview-action ${syncScroll ? 'active' : ''}`}
            disabled={!activeFile}
            title={syncScroll ? t('preview.unsyncScroll') : t('preview.syncScroll')}
            onClick={toggleSyncScroll}
          >
            <Icon name={syncScroll ? 'link' : 'unlink'} />
          </ToolbarButton>
        </div>
      </div>
      <PreviewContent previewRef={previewRef} onPreviewElementChange={onPreviewElementChange} />
    </section>
  );
}
