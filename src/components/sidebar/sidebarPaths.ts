import { Backend } from '../../platform/common/backend';

/**
 * Path, content-URI, and Markdown-snippet helpers used by the sidebar.
 *
 * These are plain string transforms kept out of the sidebar components so the
 * path rules (workspace roots, Android content URIs, relative image links) can
 * be read and tested on their own.
 */

export function displayWorkspacePath(path: string): string {
  if (path.startsWith('~android/')) return path.slice('~android/'.length);
  if (path.startsWith('content://')) return androidContentWorkspaceDisplayName(path);
  return path;
}

export function androidContentWorkspaceDisplayName(path: string): string {
  try {
    const url = new URL(path);
    const treeId = androidTreeDocumentId(url);
    if (treeId) return androidDocumentIdDisplayName(treeId);
    if (url.hostname === 'com.android.providers.downloads.documents') return 'Downloads';
    if (url.hostname === 'com.android.externalstorage.documents') return 'Storage';
    if (url.hostname === 'com.android.providers.media.documents') return 'Media';
    return url.hostname || 'Android document';
  } catch {
    return 'Android document';
  }
}

export function androidTreeDocumentId(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  const treeIndex = parts.indexOf('tree');
  if (treeIndex < 0 || treeIndex + 1 >= parts.length) return null;
  return decodeURIComponent(parts[treeIndex + 1]);
}

export function androidDocumentIdDisplayName(documentId: string): string {
  const withoutVolume = documentId.startsWith('primary:') ? documentId.slice('primary:'.length) : documentId;
  const normalized = withoutVolume.replace(/^\/+/, '');
  if (normalized === 'Download') return 'Downloads';
  if (normalized.startsWith('Download/')) return normalized.replace('Download', 'Downloads').replace(/\//g, ' / ');
  return normalized.replace(/\//g, ' / ') || 'Android document';
}

export function parentFolderPath(path: string): string {
  const separator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return separator > 0 ? path.slice(0, separator) : path;
}

export function isWorkspaceImageAsset(path: string): boolean {
  const contentUri = parseContentTreeDocumentUri(path);
  const normalized = (contentUri?.documentId ?? path).replace(/\\/g, '/').toLowerCase();
  return (
    normalized.includes('/.assets/') &&
    /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(normalized)
  );
}

export function localImagePreviewSrc(path: string): string {
  return Backend.runtime.toFileSrc(path);
}

export function appendBlockSnippet(value: string, snippet: string): string {
  if (!value) return snippet;
  return `${value.endsWith('\n') ? '' : '\n'}${snippet}`;
}

export function markdownImageSnippet(path: string, altText: string, defaultAlt = 'image'): string {
  const alt = escapeMarkdownAlt(altText.replace(/\.[^.]+$/, '') || defaultAlt);
  return `![${alt}](<${escapeMarkdownDestination(path)}>)`;
}

export function markdownImagePathForDocument(imagePath: string, documentPath: string): string {
  if (isPlaceholderDocumentPath(documentPath)) return normalizePath(imagePath);
  if (isContentUriPath(documentPath)) return markdownImagePathForContentDocument(imagePath, documentPath);

  const image = normalizePath(imagePath);
  const documentDir = parentFolderFromPath(documentPath);
  if (!documentDir || pathRoot(image) !== pathRoot(documentDir)) return image;

  const relative = relativePath(documentDir, image);
  if (!relative || relative.startsWith('../')) return relative || fileNameFromPath(image);
  return relative.startsWith('./') ? relative : `./${relative}`;
}

export function markdownImagePathForContentDocument(imagePath: string, documentPath: string): string {
  if (!isContentUriPath(imagePath)) return normalizePath(imagePath);

  const image = parseContentTreeDocumentUri(imagePath);
  const document = parseContentTreeDocumentUri(documentPath);
  if (!image || !document || image.prefix !== document.prefix || image.treeId !== document.treeId) {
    return normalizePath(imagePath);
  }

  const documentParentId = parentContentDocumentId(document.documentId);
  if (!documentParentId || !image.documentId.startsWith(`${documentParentId}/`)) return normalizePath(imagePath);

  const relative = image.documentId.slice(documentParentId.length + 1);
  return relative.startsWith('.') ? `./${relative}` : relative;
}

export function relativePath(fromDirectory: string, toPath: string): string {
  const fromParts = pathParts(fromDirectory);
  const toParts = pathParts(toPath);
  let common = 0;

  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common += 1;
  }

  return [...Array.from({ length: fromParts.length - common }, () => '..'), ...toParts.slice(common)].join('/');
}

export function parentFolderFromPath(path: string): string | null {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return null;
  return normalized.slice(0, index);
}

export function pathParts(path: string): string[] {
  return normalizePath(path)
    .replace(/^[A-Za-z]:\//, '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean);
}

export function pathRoot(path: string): string {
  const normalized = normalizePath(path);
  const windowsDrive = normalized.match(/^[A-Za-z]:\//)?.[0];
  if (windowsDrive) return windowsDrive.toUpperCase();
  return normalized.startsWith('/') ? '/' : '';
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function isPlaceholderDocumentPath(path: string): boolean {
  return path.startsWith('~') || path.startsWith('browser://');
}

export function isPathInsideWorkspaceEntry(path: string, entryPath: string): boolean {
  return path === entryPath || path.startsWith(`${entryPath}/`) || path.startsWith(`${entryPath}\\`);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isContentUriPath(path: string): boolean {
  return /^content:\/\//i.test(path);
}

export function parseContentTreeDocumentUri(path: string): { prefix: string; treeId: string; documentId: string } | null {
  try {
    const url = new URL(path);
    const parts = url.pathname.split('/').filter(Boolean);
    const treeIndex = parts.indexOf('tree');
    const documentIndex = parts.indexOf('document');
    if (url.protocol !== 'content:' || treeIndex < 0 || documentIndex < 0) return null;
    if (treeIndex + 1 >= parts.length || documentIndex + 1 >= parts.length) return null;
    return {
      prefix: `${url.protocol}//${url.host}`,
      treeId: decodeURIComponent(parts[treeIndex + 1]),
      documentId: decodeURIComponent(parts[documentIndex + 1]),
    };
  } catch {
    return null;
  }
}

export function parentContentDocumentId(documentId: string): string | null {
  const index = documentId.lastIndexOf('/');
  if (index <= 0) return null;
  return documentId.slice(0, index);
}

export function fileNameFromPath(path: string): string {
  return normalizePath(path).split('/').filter(Boolean).pop() ?? 'image';
}

export function escapeMarkdownDestination(path: string): string {
  return normalizePath(path).replace(/>/g, '%3E');
}

export function escapeMarkdownAlt(value: string): string {
  return value.replace(/]/g, '\\]');
}
