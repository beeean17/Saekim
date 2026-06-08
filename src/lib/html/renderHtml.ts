const allowedTags = new Set([
  'a',
  'abbr',
  'article',
  'aside',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'dfn',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'main',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
]);

const safeRemovedTags = new Set([
  'base',
  'button',
  'canvas',
  'embed',
  'form',
  'frame',
  'frameset',
  'iframe',
  'input',
  'link',
  'meta',
  'noscript',
  'object',
  'option',
  'script',
  'select',
  'style',
  'svg',
  'textarea',
  'template',
]);

const browserRemovedTags = new Set([
  'base',
  'button',
  'embed',
  'form',
  'frame',
  'frameset',
  'iframe',
  'input',
  'noscript',
  'object',
  'option',
  'script',
  'select',
  'textarea',
  'template',
]);

const globalAttributes = new Set(['aria-label', 'aria-labelledby', 'aria-describedby', 'class', 'dir', 'id', 'lang', 'role', 'title']);
const tableAttributes = new Set(['align', 'colspan', 'rowspan', 'scope']);
const imageAttributes = new Set(['alt', 'decoding', 'height', 'loading', 'src', 'width']);
const anchorAttributes = new Set(['href', 'rel', 'target']);

export interface HtmlRenderOptions {
  toFileSrc?: (path: string) => string;
}

export function renderSafeHtmlDocument(source: string, ownerPath?: string, options: HtmlRenderOptions = {}): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'text/html');
  const root = doc.createElement('div');
  root.className = 'html-preview';

  Array.from(doc.body.childNodes).forEach((node) => root.append(node.cloneNode(true)));
  sanitizeChildren(root, ownerPath, options.toFileSrc ?? toFileHref);

  return root.outerHTML;
}

export function renderBrowserHtmlDocument(source: string, ownerPath?: string, options: HtmlRenderOptions = {}): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'text/html');

  sanitizeBrowserElement(doc.documentElement, ownerPath, options.toFileSrc ?? toFileHref);
  ensureBrowserPreviewBaseStyles(doc);

  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

function sanitizeChildren(parent: Element, ownerPath: string | undefined, toFileSrc: (path: string) => string): void {
  Array.from(parent.children).forEach((child) => sanitizeElement(child, ownerPath, toFileSrc));
}

function sanitizeElement(element: Element, ownerPath: string | undefined, toFileSrc: (path: string) => string): void {
  const tagName = element.tagName.toLowerCase();

  if (safeRemovedTags.has(tagName)) {
    element.remove();
    return;
  }

  sanitizeChildren(element, ownerPath, toFileSrc);

  if (!allowedTags.has(tagName)) {
    element.replaceWith(...Array.from(element.childNodes));
    return;
  }

  sanitizeAttributes(element, ownerPath, toFileSrc);
}

function sanitizeBrowserElement(element: Element, ownerPath: string | undefined, toFileSrc: (path: string) => string): void {
  const tagName = element.tagName.toLowerCase();

  if (browserRemovedTags.has(tagName)) {
    element.remove();
    return;
  }

  Array.from(element.children).forEach((child) => sanitizeBrowserElement(child, ownerPath, toFileSrc));
  sanitizeBrowserAttributes(element, ownerPath, toFileSrc);
}

function sanitizeBrowserAttributes(element: Element, ownerPath: string | undefined, toFileSrc: (path: string) => string): void {
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'link' && !isAllowedBrowserLink(element)) {
    element.remove();
    return;
  }

  Array.from(element.attributes).forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (name.startsWith('on') || name === 'srcdoc' || name === 'integrity') {
      element.removeAttribute(attribute.name);
      return;
    }

    if (name === 'href') {
      const href = tagName === 'link' ? sanitizeResourceSource(value, ownerPath, toFileSrc) : sanitizeHref(value, ownerPath);
      if (!href) {
        element.removeAttribute(attribute.name);
        return;
      }
      element.setAttribute('href', href);
      if (tagName === 'a') element.setAttribute('rel', 'noopener noreferrer');
      return;
    }

    if (name === 'src' || name === 'poster') {
      const src = sanitizeResourceSource(value, ownerPath, toFileSrc);
      if (!src) {
        element.removeAttribute(attribute.name);
        return;
      }
      element.setAttribute(attribute.name, src);
      return;
    }

    if (name === 'srcset') {
      element.removeAttribute(attribute.name);
    }
  });
}

function ensureBrowserPreviewBaseStyles(doc: Document): void {
  const style = doc.createElement('style');
  style.textContent = `
    html {
      background: #fff;
      color: #111827;
    }
    body {
      min-height: 100vh;
      margin: 0;
      box-sizing: border-box;
    }
    img, video {
      max-width: 100%;
      height: auto;
    }
  `;
  doc.head.prepend(style);
}

function sanitizeAttributes(element: Element, ownerPath: string | undefined, toFileSrc: (path: string) => string): void {
  const tagName = element.tagName.toLowerCase();

  Array.from(element.attributes).forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (name.startsWith('on') || name === 'style' || name === 'srcset') {
      element.removeAttribute(attribute.name);
      return;
    }

    if (!isAllowedAttribute(tagName, name)) {
      element.removeAttribute(attribute.name);
      return;
    }

    if (name === 'href') {
      const href = sanitizeHref(value, ownerPath);
      if (!href) {
        element.removeAttribute(attribute.name);
        return;
      }
      element.setAttribute('href', href);
      element.setAttribute('rel', 'noopener noreferrer');
      return;
    }

    if (name === 'src') {
      const src = sanitizeImageSource(value, ownerPath, toFileSrc);
      if (!src) {
        element.removeAttribute(attribute.name);
        return;
      }
      element.setAttribute('src', src);
    }
  });
}

function isAllowedAttribute(tagName: string, name: string): boolean {
  if (globalAttributes.has(name) || name.startsWith('aria-') || name.startsWith('data-')) {
    return true;
  }

  if (tagName === 'a') return anchorAttributes.has(name);
  if (tagName === 'img') return imageAttributes.has(name);
  if (['td', 'th', 'col', 'colgroup'].includes(tagName)) return tableAttributes.has(name);
  if (tagName === 'time') return name === 'datetime';
  if (tagName === 'ol') return name === 'start' || name === 'type';

  return false;
}

function sanitizeHref(value: string, ownerPath?: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) return trimmed;

  const localPath = resolveLocalPath(trimmed, ownerPath);
  if (localPath) return toFileHref(localPath);

  return isSafeUrl(trimmed, ['http:', 'https:', 'mailto:', 'tel:', 'file:']) ? trimmed : null;
}

function sanitizeImageSource(value: string, ownerPath: string | undefined, toFileSrc: (path: string) => string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isSafeDataImage(trimmed)) return trimmed;

  const localPath = resolveLocalPath(trimmed, ownerPath);
  if (localPath) return toFileSrc(localPath);

  return isSafeUrl(trimmed, ['http:', 'https:', 'file:', 'asset:']) ? trimmed : null;
}

function sanitizeResourceSource(value: string, ownerPath: string | undefined, toFileSrc: (path: string) => string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isSafeDataImage(trimmed)) return trimmed;

  const localPath = resolveLocalPath(trimmed, ownerPath);
  if (localPath) return toFileSrc(localPath);

  return isSafeUrl(trimmed, ['http:', 'https:', 'file:', 'asset:']) ? trimmed : null;
}

function isSafeUrl(value: string, protocols: string[]): boolean {
  try {
    const parsed = new URL(value);
    return protocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeDataImage(value: string): boolean {
  return /^data:image\/(?:png|jpe?g|gif|webp|bmp|avif);base64,/i.test(value);
}

function isAllowedBrowserLink(element: Element): boolean {
  const rel = element.getAttribute('rel')?.toLowerCase() ?? '';
  return rel.split(/\s+/).some((value) => ['stylesheet', 'preload', 'preconnect', 'dns-prefetch', 'icon'].includes(value));
}

function resolveLocalPath(value: string, ownerPath?: string): string | null {
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || value.startsWith('#')) return null;

  const decoded = decodeUrlPath(value);
  if (isLocalAbsolutePath(decoded)) return decoded;
  if (!ownerPath || decoded.startsWith('//')) return null;

  return joinPath(dirname(ownerPath), decoded);
}

function isLocalAbsolutePath(value: string): boolean {
  return value.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(value);
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '';
}

function joinPath(base: string, relative: string): string {
  const separator = base.includes('\\') ? '\\' : '/';
  const parts = `${base}${separator}${relative}`.replace(/\\/g, '/').split('/');
  const output: string[] = [];

  parts.forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') {
      output.pop();
      return;
    }
    output.push(part);
  });

  return `${base.startsWith('/') ? '/' : ''}${output.join('/')}`;
}

function toFileHref(path: string): string {
  if (/^[a-zA-Z]:[\\/]/.test(path)) {
    return `file:///${encodeURI(path.replace(/\\/g, '/'))}`;
  }

  return `file://${encodeURI(path)}`;
}

function decodeUrlPath(src: string): string {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
}
