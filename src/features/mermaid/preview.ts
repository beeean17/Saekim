import type { PreviewContribution } from '../../app/feature';
import { registerMarkdownFenceRenderer } from '../../core/markdown/extensions';

registerMarkdownFenceRenderer({
  id: 'mermaid',
  priority: 100,
  match: ({ lang }) => lang === 'mermaid',
  render: ({ attrs, content }) => `<div class="mermaid-block"${attrs} data-source="${encodeURIComponent(content)}"></div>`,
});

export const mermaidPreviewEnhancement: PreviewContribution = {
  id: 'mermaid.preview-enhancement',
  priority: 40,
  match: ({ fileType }) => fileType.previewKind === 'markdown',
  async afterRender(root, { theme }, signal) {
    const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block[data-source]'));
    if (blocks.length === 0 || signal.aborted) return;

    const { default: mermaid } = await import('mermaid');
    if (signal.aborted) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'default' ? 'default' : 'dark',
      securityLevel: 'strict',
    });

    await Promise.all(
      blocks.map(async (block, index) => {
        try {
          const source = decodeURIComponent(block.dataset.source || '');
          const id = `mermaid-${Date.now()}-${index}`;
          const { svg } = await mermaid.render(id, source);
          if (!signal.aborted) {
            block.innerHTML = svg;
            block.dataset.rendered = 'true';
          }
        } catch (error) {
          console.error('failed to render mermaid block', error);
          if (!signal.aborted) block.dataset.rendered = 'false';
        }
      }),
    );
  },
};
