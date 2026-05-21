const markdownExtensions = new Set(['md', 'markdown', 'mdown', 'mkd']);

export function getFileExtension(name?: string, path?: string): string {
  const value = name || path || '';
  const fileName = value.split(/[\\/]/).pop() ?? value;
  return fileName.includes('.') ? fileName.split('.').pop()?.trim().toLowerCase() ?? '' : '';
}

export function getFileTypeLabel(name?: string, path?: string): string {
  const extension = getFileExtension(name, path);

  if (!extension) return 'txt';
  if (markdownExtensions.has(extension)) return 'md';
  return extension;
}

export function isMarkdownFile(name?: string, path?: string): boolean {
  return markdownExtensions.has(getFileExtension(name, path));
}
