import type { BackendAdapter, CloseDecision, ImagePickPayload } from '../common/BackendAdapter';
import type { BlockLayout, DocumentSnapshot, DocumentSnapshotSummary } from '../../types/metadata';
import type { AppSession } from '../../types/session';
import type {
  FileTreeNode,
  FolderPayload,
  OpenFilePayload,
  FileRevision,
  SaveFileResult,
  TextEncoding,
  WorkspaceSearchPage,
  WorkspaceSearchRequest,
} from '../../types/workspace';
import { requestChoice } from '../../core/dialogs/confirm';
import { translateCurrent } from '../../i18n/current';

const sessionKey = 'saekim-browser-session';
const blockLayoutPrefix = 'saekim-block-layouts:';
const documentSnapshotPrefix = 'saekim-document-snapshots:';
const maxDocumentSnapshots = 100;

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
    renameEntry: unsupported('Workspace rename'),
    createFile: unsupported('Workspace file creation'),
    createFolder: unsupported('Workspace folder creation'),
    duplicateFile: unsupported('Workspace file duplication'),
    trashEntry: unsupported('Workspace trash'),
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
    listDocumentSnapshots,
    loadDocumentSnapshot,
    loadWorkspaceSession,
    loadBlockLayouts,
    saveBlockLayout,
    saveBlockLayouts,
  },
  export: {
    pickPdfExportPath,
    printWebviewPdf,
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
    setWindowBackgroundColor: noop,
    setWindowDocumentState: noop,
    openNewWindow,
    runWindowAction: noop,
    toggleFullscreen,
    isFullscreen,
  },
};

async function noop(): Promise<void> {}

function unsupported<T>(capability: string): (..._args: unknown[]) => Promise<T> {
  return async () => {
    throw new Error(`${capability} is only available in the desktop app.`);
  };
}

async function logEvent(scope: string, message: string, details?: unknown): Promise<void> {
  if (details === undefined) console.info(`[saekim:${scope}] ${message}`);
  else console.info(`[saekim:${scope}] ${message}`, details);
}

async function listenNoop(): Promise<() => void> {
  return () => {};
}

async function confirmUnsavedChanges(fileNames: readonly string[]): Promise<CloseDecision> {
  /* Save / discard / cancel, in the app's own dialog. */
  const choice = await requestChoice({
    title: translateCurrent('document.unsavedChanges'),
    message: translateCurrent('document.closeUnsaved', { files: fileNames.join(', ') }),
    confirmLabel: translateCurrent('command.save'),
    discardLabel: translateCurrent('document.discard'),
    cancelLabel: translateCurrent('common.cancel'),
  });
  if (choice === 'confirm') return 'save';
  return choice === 'discard' ? 'discard' : 'cancel';
}

async function toggleFullscreen(): Promise<boolean> {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return false;
  }
  await document.documentElement.requestFullscreen();
  return true;
}

async function isFullscreen(): Promise<boolean> {
  return Boolean(document.fullscreenElement);
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
    revision: browserFileRevision(path, content),
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

async function saveFile(
  path: string | null,
  content: string,
  encoding: TextEncoding,
  options: { expectedRevision?: FileRevision; force?: boolean } = {},
): Promise<SaveFileResult> {
  if (!path) return saveFileAs(content, 'untitled.md', encoding);
  const currentContent = localStorage.getItem(`saekim-file:${path}`) ?? '';
  const currentRevision = browserFileRevision(path, currentContent);
  if (!options.force && options.expectedRevision && !sameRevision(options.expectedRevision, currentRevision)) {
    return { status: 'conflict', path, revision: currentRevision };
  }
  localStorage.setItem(`saekim-file:${path}`, content);
  const revision = { modifiedAt: Date.now(), size: new TextEncoder().encode(content).length };
  localStorage.setItem(browserRevisionKey(path), JSON.stringify(revision));
  return { status: 'saved', path, revision };
}

async function saveFileAs(content: string, suggestedName: string, _encoding: TextEncoding): Promise<SaveFileResult> {
  const path = `browser://${suggestedName || 'untitled.md'}`;
  localStorage.setItem(`saekim-file:${path}`, content);
  const revision = { modifiedAt: Date.now(), size: new TextEncoder().encode(content).length };
  localStorage.setItem(browserRevisionKey(path), JSON.stringify(revision));
  return { status: 'saved', path, revision };
}

function browserRevisionKey(path: string): string {
  return `saekim-file-revision:${path}`;
}

function browserFileRevision(path: string, content: string): FileRevision {
  const raw = localStorage.getItem(browserRevisionKey(path));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as FileRevision;
      if (Number.isFinite(parsed.modifiedAt) && Number.isFinite(parsed.size)) return parsed;
    } catch {
      // Legacy browser files get a stable synthetic revision below.
    }
  }
  return { modifiedAt: 0, size: new TextEncoder().encode(content).length };
}

function sameRevision(left: FileRevision, right: FileRevision): boolean {
  return left.modifiedAt === right.modifiedAt && left.size === right.size;
}

async function pickPdfExportPath(_suggestedName: string): Promise<string | null> {
  return null;
}

async function printWebviewPdf(
  _path: string,
  _contentWidth: number,
  _contentHeight: number,
): Promise<import('../common/BackendAdapter').NativePdfExportResult> {
  return { status: 'unsupported' };
}

async function writePdfExport(_path: string, _pdfData: string): Promise<string> {
  throw new Error('Native PDF export is only available in the desktop app.');
}

async function loadSession<T>(): Promise<T | null> {
  const raw = localStorage.getItem(sessionKey);
  return raw ? (JSON.parse(raw) as T) : null;
}

async function saveSession<T>(session: T, scope: import('../common/BackendAdapter').SessionSaveScope): Promise<void> {
  localStorage.setItem(sessionKey, JSON.stringify(session));
  if (scope === 'documents') saveBrowserDocumentSnapshots(session as AppSession);
}

async function deleteDocumentDraft(_filePath: string): Promise<void> {}

async function listDocumentSnapshots(filePath: string): Promise<DocumentSnapshotSummary[]> {
  return readBrowserDocumentSnapshots(filePath).map(({ content: _content, ...summary }) => summary);
}

async function loadDocumentSnapshot(snapshotId: string): Promise<DocumentSnapshot | null> {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(documentSnapshotPrefix)) continue;
    const snapshot = readBrowserSnapshotKey(key).find((item) => item.id === snapshotId);
    if (snapshot) return snapshot;
  }
  return null;
}

function saveBrowserDocumentSnapshots(session: AppSession): void {
  const createdAt = Date.now();
  for (const file of session.workspace.openFiles) {
    const source = file.path.startsWith('~') || file.content !== file.savedContent || file.encoding !== file.savedEncoding
      ? 'autosave'
      : 'saved';
    const snapshots = readBrowserDocumentSnapshots(file.path);
    const previous = snapshots[0];
    if (
      previous?.content === file.content &&
      previous.encoding === file.encoding &&
      previous.eol === file.eol &&
      previous.source === source
    ) {
      continue;
    }
    const snapshot: DocumentSnapshot = {
      id: browserSnapshotId(file.path, file.content, source, createdAt, previous?.id),
      filePath: file.path,
      content: file.content,
      encoding: file.encoding,
      eol: file.eol,
      source,
      characterCount: Array.from(file.content).length,
      createdAt,
    };
    persistBrowserDocumentSnapshots(file.path, [snapshot, ...snapshots].slice(0, maxDocumentSnapshots));
  }
}

function readBrowserDocumentSnapshots(filePath: string): DocumentSnapshot[] {
  return readBrowserSnapshotKey(browserSnapshotKey(filePath));
}

function readBrowserSnapshotKey(key: string): DocumentSnapshot[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const snapshots = JSON.parse(raw) as DocumentSnapshot[];
    return Array.isArray(snapshots) ? snapshots : [];
  } catch {
    return [];
  }
}

function persistBrowserDocumentSnapshots(filePath: string, snapshots: DocumentSnapshot[]): void {
  const key = browserSnapshotKey(filePath);
  const candidates = [...snapshots];
  while (candidates.length > 0) {
    try {
      localStorage.setItem(key, JSON.stringify(candidates));
      return;
    } catch {
      candidates.pop();
    }
  }
  console.warn('Local version history could not store this document snapshot.');
}

function browserSnapshotKey(filePath: string): string {
  return `${documentSnapshotPrefix}${encodeURIComponent(filePath)}`;
}

function browserSnapshotId(filePath: string, content: string, source: string, createdAt: number, previousId?: string): string {
  let hash = 2166136261;
  const input = `${filePath}\u0000${content}\u0000${source}\u0000${createdAt}\u0000${previousId ?? ''}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `snapshot_${createdAt}_${(hash >>> 0).toString(16)}`;
}

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
