import type { PreviewContribution } from '../../app/feature';
import { renderMarkdown } from '../../lib/markdown/renderer';

export const markdownPreviewContribution: PreviewContribution = {
  id: 'markdown.preview',
  priority: 50,
  supportsBlockLayouts: true,
  match: ({ fileType }) => fileType.previewKind === 'markdown',
  async render({ file, theme }) {
    const mode = theme === 'dark' || theme === 'nord' ? 'dark' : 'light';
    return {
      kind: 'html',
      html: await renderMarkdown(file.content, mode, file.path),
    };
  },
};
