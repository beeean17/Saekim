import type { PreviewContribution } from '../../app/feature';
import { renderBrowserHtmlDocument, renderSafeHtmlDocument } from './renderHtml';
import { Backend } from '../../platform/common/backend';
import { SegmentedControl } from '../../components/ui/primitives/SegmentedControl';
import { useI18n } from '../../i18n/useI18n';
import type { HtmlPreviewMode } from '../../types/session';

export const htmlPreviewContribution: PreviewContribution = {
  id: 'html-preview.preview',
  priority: 60,
  match: ({ fileType }) => fileType.previewKind === 'html',
  render({ file, htmlPreviewMode }) {
    return {
      kind: 'html',
      renderMode: htmlPreviewMode === 'browser' ? 'browser-frame' : 'default',
      html:
        htmlPreviewMode === 'browser'
          ? renderBrowserHtmlDocument(file.content, file.path, { toFileSrc: Backend.runtime.toFileSrc })
          : renderSafeHtmlDocument(file.content, file.path, { toFileSrc: Backend.runtime.toFileSrc }),
    };
  },
  head({ htmlPreviewMode, setHtmlPreviewMode }) {
    return <HtmlPreviewModeControl value={htmlPreviewMode} onChange={setHtmlPreviewMode} />;
  },
};

function HtmlPreviewModeControl({ value, onChange }: { value: HtmlPreviewMode; onChange(value: HtmlPreviewMode): void }) {
  const { t } = useI18n();

  return (
    <SegmentedControl
      ariaLabel={t('preview.htmlMode')}
      className="html-preview-mode"
      size="sm"
      value={value}
      options={[
        { value: 'browser', label: t('preview.browser'), title: t('preview.browserTitle') },
        { value: 'safe', label: t('preview.safe'), title: t('preview.safeTitle') },
      ]}
      onChange={onChange}
    />
  );
}
