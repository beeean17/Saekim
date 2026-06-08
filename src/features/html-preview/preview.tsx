import type { PreviewContribution } from '../../app/feature';
import { renderBrowserHtmlDocument, renderSafeHtmlDocument } from './renderHtml';
import { Backend } from '../../platform/common/backend';
import { SegmentedControl } from '../../components/ui/primitives/SegmentedControl';

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
    return (
      <SegmentedControl
        ariaLabel="HTML 미리보기 모드"
        className="html-preview-mode"
        size="sm"
        value={htmlPreviewMode}
        options={[
          { value: 'browser', label: '브라우저', title: '브라우저처럼 보기' },
          { value: 'safe', label: '안전', title: '안전하게 보기' },
        ]}
        onChange={setHtmlPreviewMode}
      />
    );
  },
};
