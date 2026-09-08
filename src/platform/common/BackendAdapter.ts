import type { BlockLayout } from '../../types/metadata';
import type { WorkspaceSession } from '../../types/session';
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

export interface BackendAdapter {
  files: FileBackend;
  folders: FolderBackend;
  images: ImageAssetBackend;
  metadata: MetadataBackend;
  export: ExportBackend;
  runtime: RuntimeBackend;
}

export interface FileBackend {
  openFileDialog(): Promise<OpenFilePayload | null>;
  importPdf(path: string): Promise<OpenFilePayload>;
  readFile(path: string): Promise<OpenFilePayload>;
  saveFile(
    path: string | null,
    content: string,
    encoding: TextEncoding,
    options?: { expectedRevision?: FileRevision; force?: boolean },
  ): Promise<SaveFileResult>;
  saveFileAs(content: string, suggestedName: string, encoding: TextEncoding): Promise<SaveFileResult>;
}

export interface FolderBackend {
  openFolderDialog(): Promise<string | null>;
  readFolder(path: string): Promise<FolderPayload>;
  readFolderChildren(path: string): Promise<FileTreeNode[]>;
  searchWorkspace(request: WorkspaceSearchRequest): Promise<WorkspaceSearchPage>;
  renameEntry(path: string, newName: string): Promise<string>;
  createFolder(parentPath: string, name: string): Promise<string>;
  duplicateFile(path: string): Promise<string>;
  trashEntry(path: string): Promise<void>;
}

export interface ImageAssetBackend {
  pickImagePath(): Promise<ImagePickPayload | null>;
  resolveImageSrc(path: string): Promise<string | null>;
  copyImageToAssets(sourcePath: string, currentFilePath: string): Promise<string>;
  importImageBytesToAssets(bytes: number[], fileName: string | null, mimeType: string | null, currentFilePath: string): Promise<string>;
  downloadImageToAssets(id: string, imageUrl: string, currentFilePath: string): Promise<string>;
}

export interface ImagePickPayload {
  path: string;
  name: string;
  displayPath?: string | null;
}

export interface MetadataBackend {
  loadSession<T>(): Promise<T | null>;
  saveSession<T>(session: T, scope: SessionSaveScope): Promise<void>;
  deleteDocumentDraft(filePath: string): Promise<void>;
  loadWorkspaceSession(workspacePath: string): Promise<WorkspaceSession | null>;
  loadBlockLayouts(filePath: string): Promise<BlockLayout[]>;
  saveBlockLayout(layout: BlockLayout): Promise<void>;
  saveBlockLayouts(layouts: readonly BlockLayout[]): Promise<void>;
}

export type SessionSaveScope = 'ui' | 'documents';

export interface ExportBackend {
  pickPdfExportPath(suggestedName: string): Promise<string | null>;
  printWebviewPdf(path: string, contentWidth: number, contentHeight: number): Promise<NativePdfExportResult>;
  writePdfExport(path: string, pdfData: string): Promise<string>;
}

export interface NativePdfExportResult {
  status: 'saved' | 'unsupported';
  path?: string | null;
}

export interface RuntimeBackend {
  isTauriRuntime(): boolean;
  isExternalUrl(url: string): boolean;
  toFileSrc(path: string): string;
  logEvent(scope: string, message: string, details?: unknown): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  takePendingOpenFiles(): Promise<string[]>;
  listenExternalOpenFiles(handler: (paths: string[]) => void): Promise<() => void>;
  listenImageDownloadProgress(handler: (payload: ImageDownloadProgressPayload) => void): Promise<() => void>;
  listenNativeMenuCommands(handlers: NativeMenuCommandHandlers): Promise<() => void>;
  listenCloseRequests(handler: (request: CloseRequest) => void): Promise<() => void>;
  confirmUnsavedChanges(fileNames: readonly string[]): Promise<CloseDecision>;
  respondToCloseRequest(reason: CloseRequestReason, approved: boolean): Promise<void>;
  setWindowMinSize(width: number, height: number): Promise<void>;
  startWindowDrag(): Promise<void>;
  setWindowBackgroundColor(color: string): Promise<void>;
  setWindowDocumentState(title: string, edited: boolean, documentPath?: string): Promise<void>;
  openNewWindow(): Promise<void>;
  runWindowAction(action: WindowAction): Promise<void>;
}

export type WindowAction = 'minimize' | 'toggleMaximize' | 'close';
export type CloseRequestReason = 'window' | 'app';
export type CloseDecision = 'save' | 'discard' | 'cancel';

export interface CloseRequest {
  reason: CloseRequestReason;
}

export interface ImageDownloadProgressPayload {
  id: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  progress: number | null;
  message?: string;
}

export interface NativeMenuCommandHandlers {
  onNewFile(): void;
  onNewWindow(): void;
  onOpen(): void;
  onOpenFolder(): void;
  onOpenRecentFile(path: string): void;
  onOpenRecentWorkspace(path: string): void;
  onSave(): void;
  onSaveAs(): void;
  onPrint(): void;
  onCloseFile(): void;
  onCloseWindow(): void;
  onExportPdf(): void;
  onFind(): void;
  onReplace(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
  onOpenGitHub(): void;
  onShowShortcuts(): void;
}
