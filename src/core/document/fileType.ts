export type PreviewKind = 'markdown' | 'html' | 'text' | 'structured-data' | 'tabular-data';

export interface FileTypeInfo {
  label: string;
  language: string;
  previewKind: PreviewKind;
}

export interface FileTypeContribution extends FileTypeInfo {
  extensions?: string[];
  fileNames?: string[];
}

type FeatureWithFileTypes = {
  fileTypes?: FileTypeContribution | FileTypeContribution[];
};

const defaultFileType: FileTypeInfo = {
  label: 'txt',
  language: 'plaintext',
  previewKind: 'text',
};

const defaultFileNameTypes: FileTypeContribution[] = [
  {
    fileNames: ['.env', '.env.local', '.env.development', '.env.production'],
    label: 'env',
    language: 'dotenv',
    previewKind: 'text',
  },
  {
    fileNames: ['.gitignore', '.gitattributes', '.npmrc', '.nvmrc'],
    label: 'txt',
    language: 'plaintext',
    previewKind: 'text',
  },
  { fileNames: ['dockerfile'], label: 'docker', language: 'dockerfile', previewKind: 'text' },
  { fileNames: ['makefile'], label: 'make', language: 'makefile', previewKind: 'text' },
];

const defaultExtensionTypes: FileTypeContribution[] = [
  { extensions: ['txt'], ...defaultFileType },
  { extensions: ['log'], label: 'log', language: 'plaintext', previewKind: 'text' },
  { extensions: ['env'], label: 'env', language: 'dotenv', previewKind: 'text' },
  { extensions: ['css'], label: 'css', language: 'css', previewKind: 'text' },
  { extensions: ['js'], label: 'js', language: 'javascript', previewKind: 'text' },
  { extensions: ['jsx'], label: 'jsx', language: 'jsx', previewKind: 'text' },
  { extensions: ['ts'], label: 'ts', language: 'typescript', previewKind: 'text' },
  { extensions: ['tsx'], label: 'tsx', language: 'tsx', previewKind: 'text' },
  { extensions: ['xml'], label: 'xml', language: 'xml', previewKind: 'text' },
  { extensions: ['ini'], label: 'ini', language: 'ini', previewKind: 'text' },
  { extensions: ['conf'], label: 'conf', language: 'ini', previewKind: 'text' },
  { extensions: ['config'], label: 'config', language: 'ini', previewKind: 'text' },
  { extensions: ['sql'], label: 'sql', language: 'sql', previewKind: 'text' },
];

export function getFileExtension(name?: string, path?: string): string {
  const fileName = getFileName(name, path);
  return fileName.includes('.') ? fileName.split('.').pop()?.trim().toLowerCase() ?? '' : '';
}

export function getFileTypeLabel(name?: string, path?: string, features: FeatureWithFileTypes[] = []): string {
  return getFileTypeInfo(name, path, features).label;
}

export function getFileTypeInfo(name?: string, path?: string, features: FeatureWithFileTypes[] = []): FileTypeInfo {
  const fileName = getFileName(name, path).toLowerCase();
  const extension = getFileExtension(name, path);
  const contributions = [...collectFileTypeContributions(features), ...defaultFileNameTypes, ...defaultExtensionTypes];

  const nameMatch = contributions.find((contribution) =>
    contribution.fileNames?.some((candidate) => candidate.toLowerCase() === fileName),
  );
  if (nameMatch) return fileTypeInfo(nameMatch);

  const extensionMatch = contributions.find((contribution) =>
    contribution.extensions?.some((candidate) => candidate.toLowerCase() === extension),
  );
  if (extensionMatch) return fileTypeInfo(extensionMatch);

  return {
    ...defaultFileType,
    label: extension || defaultFileType.label,
  };
}

export function isMarkdownFile(name?: string, path?: string, features: FeatureWithFileTypes[] = []): boolean {
  return getFileTypeInfo(name, path, features).previewKind === 'markdown';
}

export function isHtmlFile(name?: string, path?: string, features: FeatureWithFileTypes[] = []): boolean {
  return getFileTypeInfo(name, path, features).previewKind === 'html';
}

function collectFileTypeContributions(features: FeatureWithFileTypes[]): FileTypeContribution[] {
  return features.flatMap((feature) => {
    if (!feature.fileTypes) return [];
    return Array.isArray(feature.fileTypes) ? feature.fileTypes : [feature.fileTypes];
  });
}

function fileTypeInfo(contribution: FileTypeContribution): FileTypeInfo {
  return {
    label: contribution.label,
    language: contribution.language,
    previewKind: contribution.previewKind,
  };
}

function getFileName(name?: string, path?: string): string {
  const value = name || path || '';
  return value.split(/[\\/]/).pop() ?? value;
}
