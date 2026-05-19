import MarkdownIt from 'markdown-it';
import markdownItKatex from 'markdown-it-katex';
import { codeToHtml } from 'shiki';
import { escapeHtml } from './escape';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
});

md.use(markdownItKatex, {
  throwOnError: false,
  errorColor: 'var(--danger)',
});

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const info = token.info.trim();
  const lang = info.split(/\s+/)[0] || 'text';

  if (lang === 'mermaid') {
    return `<div class="mermaid-block" data-source="${encodeURIComponent(token.content)}"></div>`;
  }

  return `<pre data-lang="${escapeHtml(lang)}"><code>${escapeHtml(token.content)}</code></pre>`;
};

export async function renderMarkdown(text: string, theme: 'light' | 'dark' = 'light'): Promise<string> {
  const raw = md.render(text);
  return highlightCode(raw, theme);
}

async function highlightCode(html: string, theme: 'light' | 'dark'): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<main>${html}</main>`, 'text/html');
  const blocks = Array.from(doc.querySelectorAll('pre[data-lang]'));

  await Promise.all(
    blocks.map(async (pre) => {
      const code = pre.textContent ?? '';
      const lang = pre.getAttribute('data-lang') || 'text';
      try {
        const highlighted = await codeToHtml(code, {
          lang,
          theme: theme === 'dark' ? 'github-dark' : 'github-light',
        });
        pre.outerHTML = highlighted;
      } catch {
        const fallback = doc.createElement('pre');
        const codeNode = doc.createElement('code');
        codeNode.textContent = code;
        fallback.append(codeNode);
        pre.replaceWith(fallback);
      }
    }),
  );

  return doc.querySelector('main')?.innerHTML ?? rawFallback(html);
}

function rawFallback(html: string): string {
  return html;
}
