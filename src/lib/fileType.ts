export type PreviewKind = 'markdown' | 'html' | 'text' | 'structured-data' | 'tabular-data';

export interface FileTypeInfo {
  label: string;
  language: string;
  previewKind: PreviewKind;
}

const defaultFileType: FileTypeInfo = {
  label: 'txt',
  language: 'plaintext',
  previewKind: 'text',
};

const fileNameMap: Record<string, FileTypeInfo> = {
  '.env': { label: 'env', language: 'dotenv', previewKind: 'text' },
  '.env.local': { label: 'env', language: 'dotenv', previewKind: 'text' },
  '.env.development': { label: 'env', language: 'dotenv', previewKind: 'text' },
  '.env.production': { label: 'env', language: 'dotenv', previewKind: 'text' },
  '.gitignore': { label: 'txt', language: 'plaintext', previewKind: 'text' },
  '.gitattributes': { label: 'txt', language: 'plaintext', previewKind: 'text' },
  '.npmrc': { label: 'txt', language: 'plaintext', previewKind: 'text' },
  '.nvmrc': { label: 'txt', language: 'plaintext', previewKind: 'text' },
  dockerfile: { label: 'docker', language: 'dockerfile', previewKind: 'text' },
  makefile: { label: 'make', language: 'makefile', previewKind: 'text' },
};

const extensionMap: Record<string, FileTypeInfo> = {
  md: { label: 'md', language: 'markdown', previewKind: 'markdown' },
  markdown: { label: 'md', language: 'markdown', previewKind: 'markdown' },
  mdown: { label: 'md', language: 'markdown', previewKind: 'markdown' },
  mkd: { label: 'md', language: 'markdown', previewKind: 'markdown' },
  txt: defaultFileType,
  log: { label: 'log', language: 'plaintext', previewKind: 'text' },
  html: { label: 'html', language: 'html', previewKind: 'html' },
  htm: { label: 'html', language: 'html', previewKind: 'html' },
  json: { label: 'json', language: 'json', previewKind: 'structured-data' },
  yml: { label: 'yaml', language: 'yaml', previewKind: 'structured-data' },
  yaml: { label: 'yaml', language: 'yaml', previewKind: 'structured-data' },
  toml: { label: 'toml', language: 'toml', previewKind: 'structured-data' },
  env: { label: 'env', language: 'dotenv', previewKind: 'text' },
  css: { label: 'css', language: 'css', previewKind: 'text' },
  js: { label: 'js', language: 'javascript', previewKind: 'text' },
  jsx: { label: 'jsx', language: 'jsx', previewKind: 'text' },
  ts: { label: 'ts', language: 'typescript', previewKind: 'text' },
  tsx: { label: 'tsx', language: 'tsx', previewKind: 'text' },
  xml: { label: 'xml', language: 'xml', previewKind: 'text' },
  csv: { label: 'csv', language: 'csv', previewKind: 'tabular-data' },
  tsv: { label: 'tsv', language: 'tsv', previewKind: 'tabular-data' },
  ini: { label: 'ini', language: 'ini', previewKind: 'text' },
  conf: { label: 'conf', language: 'ini', previewKind: 'text' },
  config: { label: 'config', language: 'ini', previewKind: 'text' },
  sql: { label: 'sql', language: 'sql', previewKind: 'text' },
};

export function getFileExtension(name?: string, path?: string): string {
  const value = name || path || '';
  const fileName = value.split(/[\\/]/).pop() ?? value;
  return fileName.includes('.') ? fileName.split('.').pop()?.trim().toLowerCase() ?? '' : '';
}

export function getFileTypeLabel(name?: string, path?: string): string {
  return getFileTypeInfo(name, path).label;
}

export function getFileTypeInfo(name?: string, path?: string): FileTypeInfo {
  const fileName = getFileName(name, path).toLowerCase();
  if (fileNameMap[fileName]) return fileNameMap[fileName];

  const extension = getFileExtension(name, path);
  return extensionMap[extension] ?? {
    ...defaultFileType,
    label: extension || defaultFileType.label,
  };
}

export function isMarkdownFile(name?: string, path?: string): boolean {
  return getFileTypeInfo(name, path).previewKind === 'markdown';
}

export function isHtmlFile(name?: string, path?: string): boolean {
  return getFileTypeInfo(name, path).previewKind === 'html';
}

function getFileName(name?: string, path?: string): string {
  const value = name || path || '';
  return value.split(/[\\/]/).pop() ?? value;
}
