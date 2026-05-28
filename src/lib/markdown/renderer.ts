import MarkdownIt from 'markdown-it';
import { convertFileSrc } from '@tauri-apps/api/core';
import katex from 'katex';
import markdownItKatex from 'markdown-it-katex';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { isTauriRuntime } from '../tauri/invoke';
import { escapeHtml } from './escape';

const katexOptions = {
  throwOnError: false,
  errorColor: '#cc3344',
};

interface FootnoteDefinition {
  id: string;
  content: string;
}

interface FootnoteDocument {
  text: string;
  definitions: FootnoteDefinition[];
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
});

md.use(markdownItKatex, katexOptions);

md.inline.ruler.before('text', 'saekim_safe_br_tag', brTagRule);
md.inline.ruler.before('emphasis', 'saekim_mark', markRule);

md.core.ruler.push('saekim_source_lines', (state: StateCore) => {
  state.tokens.forEach((token) => {
    if (token.nesting === -1 || !token.map) return;
    if (!isSourceBlockTag(token.tag)) return;
    token.attrSet('data-source-line', String(token.map[0] + 1));
    token.attrSet('data-source-end-line', String(token.map[1]));
  });
});

md.core.ruler.after('inline', 'saekim_task_lists', (state: StateCore) => {
  const listItemStack: Token[] = [];

  state.tokens.forEach((token) => {
    if (token.type === 'list_item_open') {
      listItemStack.push(token);
      return;
    }

    if (token.type === 'list_item_close') {
      listItemStack.pop();
      return;
    }

    const listItem = listItemStack[listItemStack.length - 1];
    if (token.type !== 'inline' || !listItem) return;

    const match = token.content.match(/^\[( |x|X)\]\s+/);
    if (!match) return;

    listItem.attrJoin('class', 'task-list-item');
    token.children = taskListChildren(state.Token, token, match[1].toLowerCase() === 'x', match[0].length);
    token.content = token.content.slice(match[0].length);
  });
});

function markRule(state: StateInline, silent: boolean): boolean {
  const marker = '==';
  const start = state.pos;
  if (!state.src.startsWith(marker, start)) return false;

  const contentStart = start + marker.length;
  const contentEnd = state.src.indexOf(marker, contentStart);
  if (contentEnd <= contentStart) return false;
  if (silent) return false;

  state.push('mark_open', 'mark', 1).markup = marker;

  const previousPos = state.pos;
  const previousMax = state.posMax;
  state.pos = contentStart;
  state.posMax = contentEnd;
  state.md.inline.tokenize(state);
  state.pos = previousPos;
  state.posMax = previousMax;

  state.push('mark_close', 'mark', -1).markup = marker;
  state.pos = contentEnd + marker.length;
  return true;
}

function brTagRule(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x3c) return false;

  const match = state.src.slice(state.pos).match(/^<br\s*\/?>/i);
  if (!match) return false;
  if (silent) return true;

  state.push('hardbreak', 'br', 0);
  state.pos += match[0].length;
  return true;
}

function taskListChildren(TokenCtor: typeof Token, token: Token, checked: boolean, markerLength: number): Token[] {
  const checkbox = new TokenCtor('html_inline', '', 0);
  checkbox.content = `<input class="task-list-item-checkbox" type="checkbox" disabled${checked ? ' checked' : ''}>`;

  const children = token.children ? [...token.children] : [];
  trimTaskListMarker(children, markerLength);
  return [checkbox, ...children];
}

function trimTaskListMarker(children: Token[], markerLength: number): void {
  let remaining = markerLength;
  while (children.length > 0 && remaining > 0) {
    const child = children[0];
    if (child.type !== 'text') break;

    if (child.content.length <= remaining) {
      remaining -= child.content.length;
      children.shift();
      continue;
    }

    child.content = child.content.slice(remaining);
    remaining = 0;
  }
}

md.renderer.rules.math_inline = (tokens, idx) =>
  katex.renderToString(tokens[idx].content, {
    ...katexOptions,
    displayMode: false,
  });

md.renderer.rules.math_block = (tokens, idx) => {
  const attrs = sourceLineAttributes(tokens[idx]);
  const html = katex.renderToString(tokens[idx].content.trim(), {
    ...katexOptions,
    displayMode: true,
  });
  return `<div class="math-block"${attrs}>${html}</div>\n`;
};

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const info = token.info.trim();
  const lang = info.split(/\s+/)[0] || '';
  const attrs = sourceLineAttributes(token);
  const content = normalizeFenceContent(token.content);

  if (lang === 'mermaid') {
    return `<div class="mermaid-block"${attrs} data-source="${encodeURIComponent(content)}"></div>`;
  }

  if (!lang) {
    return `<pre${attrs}><code>${escapeHtml(content)}</code></pre>`;
  }

  return `<pre${attrs} data-lang="${escapeHtml(lang)}"><code>${escapeHtml(content)}</code></pre>`;
};

let shikiModulePromise: Promise<typeof import('shiki')> | null = null;

export async function renderMarkdown(text: string, theme: 'light' | 'dark' = 'light', basePath?: string): Promise<string> {
  const footnoteDocument = extractFootnotes(normalizeTaskListShortcuts(text));
  const raw = md.render(footnoteDocument.text);
  const highlighted = await highlightCode(raw, theme);
  const withFootnotes = renderFootnotes(highlighted, footnoteDocument.definitions);
  return normalizeImageSources(withFootnotes, basePath);
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
        shikiModulePromise ??= import('shiki');
        const { codeToHtml } = await shikiModulePromise;
        const highlighted = await codeToHtml(code, {
          lang,
          theme: theme === 'dark' ? 'github-dark' : 'github-light',
        });
        const template = doc.createElement('template');
        template.innerHTML = highlighted.trim();
        const highlightedPre = template.content.firstElementChild;
        if (highlightedPre instanceof HTMLElement) {
          enhanceHighlightedCodeBlock(doc, highlightedPre, lang);
          copySourceLineAttributes(pre, highlightedPre);
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

function isSourceBlockTag(tag: string): boolean {
  return ['blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'p', 'pre', 'table', 'ul'].includes(tag);
}

function sourceLineAttributes(token: Pick<Token, 'map'>): string {
  if (!token.map) return '';
  return ` data-source-line="${token.map[0] + 1}" data-source-end-line="${token.map[1]}"`;
}

function normalizeFenceContent(content: string): string {
  return content.replace(/\n$/, '');
}

function normalizeTaskListShortcuts(text: string): string {
  let inFence = false;

  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }

      if (inFence) return line;

      return line
        .replace(/^(\s*)-\[(x|X)\](\s*)/, '$1- [x] ')
        .replace(/^(\s*)-\[\](\s*)/, '$1- [ ] ')
        .replace(/^(\s*)-\[ \](\s*)/, '$1- [ ] ');
    })
    .join('\n');
}

function copySourceLineAttributes(from: Element, to: HTMLElement): void {
  const sourceLine = from.getAttribute('data-source-line');
  const sourceEndLine = from.getAttribute('data-source-end-line');
  if (sourceLine) to.setAttribute('data-source-line', sourceLine);
  if (sourceEndLine) to.setAttribute('data-source-end-line', sourceEndLine);
}

function rawFallback(html: string): string {
  return html;
}

function extractFootnotes(text: string): FootnoteDocument {
  const lines = text.split('\n');
  const output: string[] = [];
  const definitions: FootnoteDefinition[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    if (inFence) {
      output.push(line);
      continue;
    }

    const match = line.match(/^\[\^([^\]\s]+)\]:[ \t]*(.*)$/);
    if (!match) {
      output.push(line);
      continue;
    }

    const contentLines = [match[2]];
    output.push('');

    while (index + 1 < lines.length && /^(?:[ \t]{2,}|\t)/.test(lines[index + 1])) {
      index += 1;
      contentLines.push(lines[index].trim());
      output.push('');
    }

    definitions.push({
      id: match[1],
      content: contentLines.join('\n').trim(),
    });
  }

  return {
    text: output.join('\n'),
    definitions,
  };
}

function renderFootnotes(html: string, definitions: FootnoteDefinition[]): string {
  if (definitions.length === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<main>${html}</main>`, 'text/html');
  const root = doc.querySelector('main');
  if (!root) return html;

  const indexById = new Map(definitions.map((definition, index) => [definition.id, index + 1]));
  const slugById = new Map(definitions.map((definition) => [definition.id, footnoteSlug(definition.id)]));
  const referenceCounts = new Map<string, number>();
  const textNodes = collectFootnoteTextNodes(doc, root);

  textNodes.forEach((node) => {
    const value = node.nodeValue ?? '';
    if (!/\[\^[^\]\s]+\]/.test(value)) return;

    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;

    value.replace(/\[\^([^\]\s]+)\]/g, (fullMatch, id: string, offset: number) => {
      const footnoteIndex = indexById.get(id);
      const slug = slugById.get(id);
      if (!footnoteIndex || !slug) return fullMatch;

      if (offset > lastIndex) {
        fragment.append(doc.createTextNode(value.slice(lastIndex, offset)));
      }

      const count = (referenceCounts.get(id) ?? 0) + 1;
      referenceCounts.set(id, count);
      fragment.append(createFootnoteReference(doc, slug, footnoteIndex, count));
      lastIndex = offset + fullMatch.length;
      return fullMatch;
    });

    if (lastIndex === 0) return;
    if (lastIndex < value.length) {
      fragment.append(doc.createTextNode(value.slice(lastIndex)));
    }
    node.replaceWith(fragment);
  });

  root.append(createFootnoteSection(doc, definitions, referenceCounts));
  return root.innerHTML;
}

function collectFootnoteTextNodes(doc: Document, root: Element): Text[] {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return hasIgnoredFootnoteParent(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function hasIgnoredFootnoteParent(node: Node): boolean {
  let current = node.parentElement;
  while (current) {
    if (['CODE', 'PRE', 'KBD', 'SAMP'].includes(current.tagName)) return true;
    current = current.parentElement;
  }
  return false;
}

function createFootnoteReference(doc: Document, slug: string, index: number, count: number): HTMLElement {
  const sup = doc.createElement('sup');
  sup.className = 'footnote-ref';

  const link = doc.createElement('a');
  link.href = `#fn-${slug}`;
  link.id = `fnref-${slug}-${count}`;
  link.setAttribute('aria-describedby', 'footnotes');
  link.textContent = String(index);

  sup.append(link);
  return sup;
}

function createFootnoteSection(doc: Document, definitions: FootnoteDefinition[], referenceCounts: Map<string, number>): HTMLElement {
  const section = doc.createElement('section');
  section.className = 'footnotes';
  section.id = 'footnotes';

  const title = doc.createElement('h2');
  title.className = 'sr-only';
  title.textContent = '각주';
  section.append(title);

  const list = doc.createElement('ol');
  definitions.forEach((definition) => {
    const item = doc.createElement('li');
    const slug = footnoteSlug(definition.id);
    item.id = `fn-${slug}`;
    item.innerHTML = md.renderInline(definition.content || ' ');

    const count = referenceCounts.get(definition.id) ?? 0;
    if (count > 0) {
      item.append(doc.createTextNode(' '));
      item.append(createFootnoteBacklink(doc, slug));
    }

    list.append(item);
  });
  section.append(list);

  return section;
}

function createFootnoteBacklink(doc: Document, slug: string): HTMLElement {
  const link = doc.createElement('a');
  link.className = 'footnote-backref';
  link.href = `#fnref-${slug}-1`;
  link.setAttribute('aria-label', '본문으로 돌아가기');
  link.textContent = '↩';
  return link;
}

function footnoteSlug(id: string): string {
  return encodeURIComponent(id).replace(/%/g, '');
}

function normalizeImageSources(html: string, basePath?: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<main>${html}</main>`, 'text/html');
  doc.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
    const src = image.getAttribute('src');
    if (!src) return;
    if (src.startsWith('saekim-pending-image://')) {
      image.replaceWith(createPendingImageBlock(doc, image.alt));
      return;
    }
    if (src.startsWith('saekim-failed-image://')) {
      image.replaceWith(createFailedImageBlock(doc, image.alt));
      return;
    }

    const localPath = localImagePathFromSrc(src, basePath);
    if (!localPath) return;

    image.setAttribute('data-original-src', src);
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = localPathToImageSrc(localPath);
  });

  return doc.querySelector('main')?.innerHTML ?? html;
}

function createPendingImageBlock(doc: Document, alt: string): HTMLElement {
  const progress = Number.parseInt(alt.match(/(\d+)%/)?.[1] ?? '', 10);
  const wrapper = doc.createElement('div');
  wrapper.className = 'pending-image-block';

  const label = doc.createElement('span');
  label.textContent = Number.isFinite(progress) ? `이미지 다운로드 중 ${progress}%` : '이미지 다운로드 중';

  const track = doc.createElement('div');
  track.className = 'pending-image-progress';
  const bar = doc.createElement('div');
  bar.style.width = Number.isFinite(progress) ? `${Math.max(0, Math.min(100, progress))}%` : '36%';
  if (!Number.isFinite(progress)) bar.className = 'indeterminate';

  track.append(bar);
  wrapper.append(label, track);
  return wrapper;
}

function createFailedImageBlock(doc: Document, alt: string): HTMLElement {
  const wrapper = doc.createElement('div');
  wrapper.className = 'failed-image-block';
  const title = doc.createElement('strong');
  title.textContent = '이미지 다운로드 실패';
  const message = doc.createElement('span');
  message.textContent = alt.replace(/^이미지 다운로드 실패:\s*/, '');
  wrapper.append(title, message);
  return wrapper;
}

function isLocalAbsolutePath(src: string): boolean {
  if (/^(?:https?:|data:|asset:|blob:|mailto:|#)/i.test(src)) return false;
  return src.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(src);
}

function localImagePathFromSrc(src: string, basePath?: string): string | null {
  if (isFileUrl(src)) return fileUrlToPath(src);
  if (isLocalAbsolutePath(src)) return decodeUrlPath(src);
  return resolveRelativeImagePath(src, basePath);
}

function resolveRelativeImagePath(src: string, basePath?: string): string | null {
  if (!basePath || basePath.startsWith('~') || basePath.startsWith('browser://')) return null;
  if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(src)) return null;

  const documentDir = basePath.replace(/[\\/][^\\/]*$/, '');
  if (!documentDir || documentDir === basePath) return null;
  return normalizeLocalPath(`${documentDir}/${decodeUrlPath(src)}`);
}

function localPathToImageSrc(path: string): string {
  return isTauriRuntime() ? convertFileSrc(path) : toFileHref(path);
}

function isFileUrl(src: string): boolean {
  return /^file:\/\//i.test(src);
}

function fileUrlToPath(src: string): string | null {
  try {
    const url = new URL(src);
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

function toFileHref(path: string): string {
  const normalized = normalizeLocalPath(path);
  if (/^[a-zA-Z]:\//.test(normalized)) return `file:///${encodeURI(normalized)}`;
  return `file://${encodeURI(normalized)}`;
}

function normalizeLocalPath(path: string): string {
  const isWindows = /^[a-zA-Z]:[\\/]/.test(path);
  const prefix = isWindows ? path.slice(0, 2) : path.startsWith('/') ? '/' : '';
  const rest = isWindows ? path.slice(2) : path;
  const parts = rest
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.');
  const normalized: string[] = [];

  parts.forEach((part) => {
    if (part === '..') {
      normalized.pop();
      return;
    }
    normalized.push(part);
  });

  return isWindows ? `${prefix}/${normalized.join('/')}` : `${prefix}${normalized.join('/')}`;
}

function decodeUrlPath(src: string): string {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
}
