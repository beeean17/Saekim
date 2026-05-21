import MarkdownIt from 'markdown-it';
import katex from 'katex';
import markdownItKatex from 'markdown-it-katex';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { escapeHtml } from './escape';

const katexOptions = {
  throwOnError: false,
  errorColor: '#cc3344',
};

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
});

md.use(markdownItKatex, katexOptions);
md.core.ruler.push('source_line_attrs', annotateSourceLines);

md.renderer.rules.math_inline = (tokens, idx) =>
  katex.renderToString(tokens[idx].content, {
    ...katexOptions,
    displayMode: false,
  });

md.renderer.rules.math_block = (tokens, idx) => {
  const sourceLine = getSourceLine(tokens[idx]);
  const html = katex.renderToString(tokens[idx].content.trim(), {
    ...katexOptions,
    displayMode: true,
  });
  return `<div class="math-block"${sourceLineAttr(sourceLine)}>${html}</div>\n`;
};

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const info = token.info.trim();
  const lang = info.split(/\s+/)[0] || '';
  const sourceLine = getSourceLine(token);

  if (lang === 'mermaid') {
    return `<div class="mermaid-block"${sourceLineAttr(sourceLine)} data-source="${encodeURIComponent(token.content)}"></div>`;
  }

  if (!lang) {
    return `<pre${sourceLineAttr(sourceLine)}><code>${escapeHtml(token.content)}</code></pre>`;
  }

  return `<pre${sourceLineAttr(sourceLine)} data-lang="${escapeHtml(lang)}"><code>${escapeHtml(token.content)}</code></pre>`;
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
      const lang = pre.getAttribute('data-lang');
      if (!lang) return;

      try {
        const { codeToHtml } = await import('shiki');
        const highlighted = await codeToHtml(code, {
          lang,
          theme: theme === 'dark' ? 'github-dark' : 'github-light',
        });
        const template = doc.createElement('template');
        template.innerHTML = highlighted.trim();
        const highlightedPre = template.content.firstElementChild;
        if (highlightedPre instanceof HTMLElement) {
          const sourceLine = pre.getAttribute('data-source-line');
          if (sourceLine) highlightedPre.dataset.sourceLine = sourceLine;
          enhanceHighlightedCodeBlock(doc, highlightedPre, lang);
          pre.replaceWith(highlightedPre);
        } else {
          pre.outerHTML = highlighted;
        }
      } catch {
        const fallback = doc.createElement('pre');
        const sourceLine = pre.getAttribute('data-source-line');
        if (sourceLine) fallback.dataset.sourceLine = sourceLine;
        const codeNode = doc.createElement('code');
        codeNode.textContent = code;
        fallback.append(codeNode);
        pre.replaceWith(fallback);
      }
    }),
  );

  return doc.querySelector('main')?.innerHTML ?? rawFallback(html);
}

function annotateSourceLines(state: StateCore): void {
  state.tokens.forEach((token) => {
    if (token.nesting === 1 && token.tag && token.map) {
      token.attrSet('data-source-line', String(token.map[0] + 1));
    }
  });
}

function getSourceLine(token: Token): number | null {
  return token.map ? token.map[0] + 1 : null;
}

function sourceLineAttr(sourceLine: number | null): string {
  return sourceLine === null ? '' : ` data-source-line="${sourceLine}"`;
}

function enhanceHighlightedCodeBlock(doc: Document, pre: HTMLElement, lang: string): void {
  pre.dataset.lang = lang;
  pre.setAttribute('data-label', formatLanguageLabel(lang));
  pre.querySelectorAll<HTMLElement>('.line').forEach((line, index) => {
    const text = line.textContent ?? '';
    line.dataset.line = String(index + 1);
    if (text.startsWith('+')) line.classList.add('diff-add');
    if (text.startsWith('-')) line.classList.add('diff-remove');
  });

  const code = pre.querySelector('code');
  if (!code) {
    const fallbackCode = doc.createElement('code');
    while (pre.firstChild) fallbackCode.append(pre.firstChild);
    pre.append(fallbackCode);
  }
}

function formatLanguageLabel(lang: string): string {
  const normalized = lang.toLowerCase();
  const labels: Record<string, string> = {
    bash: 'Shell',
    cjs: 'JavaScript',
    cpp: 'C++',
    csharp: 'C#',
    css: 'CSS',
    diff: 'Diff',
    go: 'Go',
    html: 'HTML',
    java: 'Java',
    js: 'JavaScript',
    json: 'JSON',
    jsx: 'JSX',
    kotlin: 'Kotlin',
    kt: 'Kotlin',
    markdown: 'Markdown',
    md: 'Markdown',
    mjs: 'JavaScript',
    py: 'Python',
    python: 'Python',
    rs: 'Rust',
    rust: 'Rust',
    sh: 'Shell',
    shell: 'Shell',
    sql: 'SQL',
    swift: 'Swift',
    ts: 'TypeScript',
    tsx: 'TSX',
    txt: 'Text',
    yaml: 'YAML',
    yml: 'YAML',
  };
  return labels[normalized] ?? normalized.toUpperCase();
}

function rawFallback(html: string): string {
  return html;
}
