import type { BackendAdapter } from '../common/BackendAdapter';
import type { BlockLayout } from '../../types/metadata';
import type { FileTreeNode, FolderPayload, OpenFilePayload } from '../../types/workspace';

const sessionKey = 'saekim-browser-session';
const blockLayoutPrefix = 'saekim-block-layouts:';

export const browserBackend: BackendAdapter = {
  files: {
    openFileDialog,
    importPdf,
    readFile,
    saveFile,
    saveFileAs,
  },
  folders: {
    openFolderDialog,
    readFolder,
    readFolderChildren,
  },
  images: {
    pickImagePath,
    copyImageToAssets,
    importImageBytesToAssets,
    downloadImageToAssets,
  },
  metadata: {
    loadSession,
    saveSession,
    loadBlockLayouts,
    saveBlockLayout,
  },
  export: {
    pickPdfExportPath,
    writePdfExport,
  },
  runtime: {
    isTauriRuntime: () => false,
    isExternalUrl,
    toFileSrc: toFileHref,
    openExternalUrl,
    takePendingOpenFiles: async () => [],
    listenExternalOpenFiles: listenNoop,
    listenImageDownloadProgress: listenNoop,
    listenNativeMenuCommands: listenNoop,
    setWindowMinSize: noop,
    startWindowDrag: noop,
    setWindowBackgroundColor: noop,
    runWindowAction: noop,
  },
};

async function noop(): Promise<void> {}

async function listenNoop(): Promise<() => void> {
  return () => {};
}

async function openFileDialog(): Promise<boolean> {
  return false;
}

async function openFolderDialog(): Promise<string | null> {
  return null;
}

async function pickImagePath(): Promise<string | null> {
  return null;
}

async function copyImageToAssets(_sourcePath: string, _currentFilePath: string): Promise<string> {
  throw new Error('Image asset import is only available in the desktop app.');
}

async function importImageBytesToAssets(
  _bytes: number[],
  _fileName: string | null,
  _mimeType: string | null,
  _currentFilePath: string,
): Promise<string> {
  throw new Error('Dropped image import is only available in the desktop app.');
}

async function downloadImageToAssets(_id: string, _imageUrl: string, _currentFilePath: string): Promise<string> {
  throw new Error('Remote image import is only available in the desktop app.');
}

async function importPdf(_path: string): Promise<OpenFilePayload> {
  throw new Error('PDF import is deferred in Saekim 3.0.0.');
}

async function readFile(path: string): Promise<OpenFilePayload> {
  const content = localStorage.getItem(`saekim-file:${path}`) ?? '';
  return {
    path,
    name: path.split('/').pop() || 'untitled.md',
    content,
  };
}

async function readFolder(path: string): Promise<FolderPayload> {
  return {
    rootPath: path,
    tree: [],
  };
}

async function readFolderChildren(_path: string): Promise<FileTreeNode[]> {
  return [];
}

async function saveFile(path: string | null, content: string): Promise<string | null> {
  if (!path) return saveFileAs(content, 'untitled.md');
  localStorage.setItem(`saekim-file:${path}`, content);
  return path;
}

async function saveFileAs(content: string, suggestedName: string): Promise<string | null> {
  const path = `browser://${suggestedName || 'untitled.md'}`;
  localStorage.setItem(`saekim-file:${path}`, content);
  return path;
}

async function pickPdfExportPath(_suggestedName: string): Promise<string | null> {
  return null;
}

async function writePdfExport(_path: string, _bytes: number[]): Promise<string> {
  throw new Error('Native PDF export is only available in the desktop app.');
}

async function loadSession<T>(): Promise<T | null> {
  const raw = localStorage.getItem(sessionKey);
  return raw ? (JSON.parse(raw) as T) : null;
}

async function saveSession<T>(session: T): Promise<void> {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

async function loadBlockLayouts(filePath: string): Promise<BlockLayout[]> {
  const raw = localStorage.getItem(`${blockLayoutPrefix}${filePath}`);
  return raw ? (JSON.parse(raw) as BlockLayout[]) : [];
}

async function saveBlockLayout(layout: BlockLayout): Promise<void> {
  const key = `${blockLayoutPrefix}${layout.filePath}`;
  const existing = await loadBlockLayouts(layout.filePath);
  const next = existing.filter(
    (item) =>
      item.blockKind !== layout.blockKind ||
      item.blockKey !== layout.blockKey ||
      item.occurrenceIndex !== layout.occurrenceIndex,
  );
  next.push(layout);
  localStorage.setItem(key, JSON.stringify(next));
}

async function openExternalUrl(url: string): Promise<void> {
  if (!isExternalUrl(url)) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function toFileHref(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) return `file:///${encodeURI(normalized)}`;
  return normalized.startsWith('/') ? `file://${encodeURI(normalized)}` : encodeURI(normalized);
}

function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:', 'tel:', 'file:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
