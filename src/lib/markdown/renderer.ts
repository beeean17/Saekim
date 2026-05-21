import MarkdownIt from 'markdown-it';
import katex from 'katex';
import markdownItKatex from 'markdown-it-katex';
import { escapeHtml } from './escape';

type MarkdownToken = {
  nesting: number;
  tag: string;
  map: [number, number] | null;
  attrSet: (name: string, value: string) => void;
  content: string;
  info: string;
};

type MarkdownCoreState = {
  tokens: MarkdownToken[];
};

const katexOptions = {
  throwOnError: false,
  errorColor: '#cc3344',
};

let shikiModulePromise: Promise<typeof import('shiki')> | null = null;

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
});

md.use(markdownItKatex, katexOptions);

md.core.ruler.push('saekim_source_lines', (state: MarkdownCoreState) => {
  state.tokens.forEach((token) => {
    if (token.nesting !== 1 || !token.tag || !token.map) return;
    token.attrSet('data-source-line', String(token.map[0] + 1));
    token.attrSet('data-source-end-line', String(token.map[1]));
  });
});

md.renderer.rules.math_inline = (tokens, idx) =>
  katex.renderToString(tokens[idx].content, {
    ...katexOptions,
    displayMode: false,
  });

md.renderer.rules.math_block = (tokens, idx) => {
  const token = tokens[idx] as MarkdownToken;
  const html = katex.renderToString(tokens[idx].content.trim(), {
    ...katexOptions,
    displayMode: true,
  });
  return `<div class="math-block"${sourceLineAttributes(token)}>${html}</div>\n`;
};

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx] as MarkdownToken;
  const info = token.info.trim();
  const lang = info.split(/\s+/)[0] || '';
  const sourceAttrs = sourceLineAttributes(token);

  if (lang === 'mermaid') {
    return `<div class="mermaid-block"${sourceAttrs} data-source="${encodeURIComponent(token.content)}"></div>`;
  }

  if (!lang) {
    return `<pre${sourceAttrs}><code>${escapeHtml(token.content)}</code></pre>`;
  }

  return `<pre${sourceAttrs} data-lang="${escapeHtml(lang)}"><code>${escapeHtml(token.content)}</code></pre>`;
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
        const { codeToHtml } = await loadShiki();
        const highlighted = await codeToHtml(code, {
          lang,
          theme: theme === 'dark' ? 'github-dark' : 'github-light',
        });
        const template = doc.createElement('template');
        template.innerHTML = highlighted.trim();
        const highlightedPre = template.content.firstElementChild;
        if (highlightedPre instanceof HTMLElement) {
          copySourceLineAttributes(pre, highlightedPre);
          enhanceHighlightedCodeBlock(doc, highlightedPre, lang);
          pre.replaceWith(highlightedPre);
        } else {
          pre.outerHTML = highlighted;
        }
      } catch {
        const fallback = doc.createElement('pre');
        const codeNode = doc.createElement('code');
        codeNode.textContent = code;
        copySourceLineAttributes(pre, fallback);
        fallback.append(codeNode);
        pre.replaceWith(fallback);
      }
    }),
  );

  return doc.querySelector('main')?.innerHTML ?? rawFallback(html);
}

function sourceLineAttributes(token: MarkdownToken): string {
  if (!token.map) return '';
  return ` data-source-line="${token.map[0] + 1}" data-source-end-line="${token.map[1]}"`;
}

function copySourceLineAttributes(source: Element, target: HTMLElement): void {
  const sourceLine = source.getAttribute('data-source-line');
  const sourceEndLine = source.getAttribute('data-source-end-line');
  if (sourceLine) target.dataset.sourceLine = sourceLine;
  if (sourceEndLine) target.dataset.sourceEndLine = sourceEndLine;
}

function loadShiki(): Promise<typeof import('shiki')> {
  shikiModulePromise ??= import('shiki');
  return shikiModulePromise;
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
