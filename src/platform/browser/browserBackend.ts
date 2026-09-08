import type { BackendAdapter, CloseDecision, ImagePickPayload } from '../common/BackendAdapter';
import type { BlockLayout } from '../../types/metadata';
import type {
  FileTreeNode,
  FolderPayload,
  OpenFilePayload,
  TextEncoding,
  WorkspaceSearchPage,
  WorkspaceSearchRequest,
} from '../../types/workspace';

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
    searchWorkspace,
  },
  images: {
    pickImagePath,
    resolveImageSrc,
    copyImageToAssets,
    importImageBytesToAssets,
    downloadImageToAssets,
  },
  metadata: {
    loadSession,
    saveSession,
    deleteDocumentDraft,
    loadWorkspaceSession,
    loadBlockLayouts,
    saveBlockLayout,
    saveBlockLayouts,
  },
  export: {
    pickPdfExportPath,
    writePdfExport,
  },
  runtime: {
    isTauriRuntime: () => false,
    isExternalUrl,
    toFileSrc: toFileHref,
    logEvent,
    openExternalUrl,
    takePendingOpenFiles: async () => [],
    listenExternalOpenFiles: listenNoop,
    listenImageDownloadProgress: listenNoop,
    listenNativeMenuCommands: listenNoop,
    listenCloseRequests: listenNoop,
    confirmUnsavedChanges,
    respondToCloseRequest: noop,
    setWindowMinSize: noop,
    startWindowDrag: noop,
    setWindowBackgroundColor: noop,
    openNewWindow,
    runWindowAction: noop,
  },
};

async function noop(): Promise<void> {}

async function logEvent(scope: string, message: string, details?: unknown): Promise<void> {
  if (details === undefined) console.info(`[saekim:${scope}] ${message}`);
  else console.info(`[saekim:${scope}] ${message}`, details);
}

async function listenNoop(): Promise<() => void> {
  return () => {};
}

async function confirmUnsavedChanges(fileNames: readonly string[]): Promise<CloseDecision> {
  return globalThis.confirm(`저장하지 않은 ${fileNames.join(', ')} 파일을 저장하고 닫을까요?`) ? 'save' : 'cancel';
}

async function openFileDialog(): Promise<OpenFilePayload | null> {
  return null;
}

async function openFolderDialog(): Promise<string | null> {
  return null;
}

async function pickImagePath(): Promise<ImagePickPayload | null> {
  return null;
}

async function resolveImageSrc(_path: string): Promise<string | null> {
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
    encoding: 'utf-8',
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

async function searchWorkspace(request: WorkspaceSearchRequest): Promise<WorkspaceSearchPage> {
  const prefix = 'saekim-file:';
  const rootPrefix = request.rootPath.endsWith('/') ? request.rootPath : `${request.rootPath}/`;
  const query = request.query.trim().toLocaleLowerCase();
  const cursor = request.cursor ?? '';
  const limit = Math.min(500, Math.max(1, request.limit ?? 100));
  const matches = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(prefix)))
    .map((key) => key.slice(prefix.length))
    .filter((path) => path.startsWith(rootPrefix))
    .map((path) => {
      const name = path.split('/').pop() || path;
      const content = localStorage.getItem(`${prefix}${path}`) ?? '';
      const contentMatch = request.scope === 'content'
        ? findBrowserWorkspaceContentMatch(content, request)
        : null;
      return {
        path,
        name,
        relativePath: path.slice(rootPrefix.length),
        ...(contentMatch ?? {}),
      };
    })
    .filter((item) => {
      if (item.relativePath <= cursor) return false;
      if (request.scope === 'content') return item.matchLine !== undefined;
      return request.caseSensitive ? item.name.includes(request.query.trim()) : item.name.toLocaleLowerCase().includes(query);
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const items = matches.slice(0, limit);

  return {
    items,
    nextCursor: matches.length > limit ? items[items.length - 1]?.relativePath ?? null : null,
  };
}

function findBrowserWorkspaceContentMatch(
  content: string,
  request: WorkspaceSearchRequest,
): Pick<import('../../types/workspace').WorkspaceSearchItem, 'matchLine' | 'matchColumn' | 'matchPreview' | 'matchCount'> | null {
  let matcher: RegExp;
  try {
    matcher = new RegExp(request.useRegex ? request.query.trim() : escapeRegularExpression(request.query.trim()), `g${request.caseSensitive ? '' : 'i'}m`);
  } catch (error) {
    throw new Error(`Invalid workspace search pattern: ${error instanceof Error ? error.message : String(error)}`);
  }
  const matches = Array.from(content.matchAll(matcher)).filter((match) => {
    if (!request.wholeWord) return true;
    const start = match.index ?? 0;
    return isBrowserWordBoundary(content[start - 1]) && isBrowserWordBoundary(content[start + match[0].length]);
  });
  const first = matches[0];
  if (!first) return null;
  const start = first.index ?? 0;
  const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEnd = content.indexOf('\n', start);
  return {
    matchLine: content.slice(0, start).split('\n').length,
    matchColumn: Array.from(content.slice(lineStart, start)).length + 1,
    matchPreview: content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim().slice(0, 180),
    matchCount: matches.length,
  };
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isBrowserWordBoundary(character: string | undefined): boolean {
  return !character || !/[\p{L}\p{N}_]/u.test(character);
}

async function saveFile(path: string | null, content: string, encoding: TextEncoding): Promise<string | null> {
  if (!path) return saveFileAs(content, 'untitled.md', encoding);
  localStorage.setItem(`saekim-file:${path}`, content);
  return path;
}

async function saveFileAs(content: string, suggestedName: string, _encoding: TextEncoding): Promise<string | null> {
  const path = `browser://${suggestedName || 'untitled.md'}`;
  localStorage.setItem(`saekim-file:${path}`, content);
  return path;
}

async function pickPdfExportPath(_suggestedName: string): Promise<string | null> {
  return null;
}

async function writePdfExport(_path: string, _pdfData: string): Promise<string> {
  throw new Error('Native PDF export is only available in the desktop app.');
}

async function loadSession<T>(): Promise<T | null> {
  const raw = localStorage.getItem(sessionKey);
  return raw ? (JSON.parse(raw) as T) : null;
}

async function saveSession<T>(session: T, _scope: import('../common/BackendAdapter').SessionSaveScope): Promise<void> {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

async function deleteDocumentDraft(_filePath: string): Promise<void> {}

async function loadWorkspaceSession(_workspacePath: string): Promise<null> {
  return null;
}

async function loadBlockLayouts(filePath: string): Promise<BlockLayout[]> {
  const raw = localStorage.getItem(`${blockLayoutPrefix}${filePath}`);
  return raw ? (JSON.parse(raw) as BlockLayout[]) : [];
}

async function saveBlockLayout(layout: BlockLayout): Promise<void> {
  await saveBlockLayouts([layout]);
}

async function saveBlockLayouts(layouts: readonly BlockLayout[]): Promise<void> {
  const layoutsByFile = new Map<string, BlockLayout[]>();
  for (const layout of layouts) {
    const existing = layoutsByFile.get(layout.filePath);
    if (existing) existing.push(layout);
    else layoutsByFile.set(layout.filePath, [layout]);
  }

  for (const [filePath, fileLayouts] of layoutsByFile) {
    const key = `${blockLayoutPrefix}${filePath}`;
    const incomingKeys = new Set(fileLayouts.map(blockLayoutStorageKey));
    const next = (await loadBlockLayouts(filePath)).filter((item) => !incomingKeys.has(blockLayoutStorageKey(item)));
    next.push(...fileLayouts);
    localStorage.setItem(key, JSON.stringify(next));
  }
}

function blockLayoutStorageKey(layout: BlockLayout): string {
  return `${layout.blockKind}:${layout.blockKey}:${layout.occurrenceIndex}`;
}

async function openExternalUrl(url: string): Promise<void> {
  if (!isExternalUrl(url)) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function openNewWindow(): Promise<void> {
  window.open(window.location.href, '_blank', 'noopener,noreferrer');
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
