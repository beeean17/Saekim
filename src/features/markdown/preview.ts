import type { PreviewContribution } from '../../app/feature';
import { renderMarkdown } from '../../core/markdown/renderer';
import { Backend } from '../../platform/common/backend';
import { createMarkdownRenderScene } from './renderScene';

export const markdownPreviewContribution: PreviewContribution = {
  id: 'markdown.preview',
  priority: 50,
  supportsBlockLayouts: true,
  match: ({ fileType }) => fileType.previewKind === 'markdown',
  async render({ file, theme }) {
    const mode = theme === 'dark' || theme === 'nord' ? 'dark' : 'light';
    const html = await renderMarkdown(file.content, {
      basePath: file.path,
      theme: mode,
      toFileSrc: Backend.runtime.toFileSrc,
      resolveImageSrc: Backend.images.resolveImageSrc,
    });
    const sceneResult = createMarkdownRenderScene(file.content, html);

    return {
      kind: 'html',
      html: sceneResult.html,
      scene: sceneResult.scene,
    };
  },
};
