import './textPreview.css';
import type { PreviewContribution } from '../../app/feature';
import { escapeHtml } from '../../lib/markdown/escape';

export const textPreviewContribution: PreviewContribution = {
  id: 'core.text-preview',
  priority: -100,
  match: () => true,
  render: ({ file }) => ({
    kind: 'html',
    html: `<pre class="plain-text-preview">${escapeHtml(file.content)}</pre>`,
  }),
};
