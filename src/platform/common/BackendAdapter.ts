import type { BlockLayout } from '../../types/metadata';
import type { WorkspaceSession } from '../../types/session';
import type { FileTreeNode, FolderPayload, OpenFilePayload } from '../../types/workspace';

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
  saveFile(path: string | null, content: string): Promise<string | null>;
  saveFileAs(content: string, suggestedName: string): Promise<string | null>;
}

export interface FolderBackend {
  openFolderDialog(): Promise<string | null>;
  readFolder(path: string): Promise<FolderPayload>;
  readFolderChildren(path: string): Promise<FileTreeNode[]>;
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
  saveSession<T>(session: T): Promise<void>;
  loadWorkspaceSession(workspacePath: string): Promise<WorkspaceSession | null>;
  loadBlockLayouts(filePath: string): Promise<BlockLayout[]>;
  saveBlockLayout(layout: BlockLayout): Promise<void>;
  saveBlockLayouts(layouts: readonly BlockLayout[]): Promise<void>;
}

export interface ExportBackend {
  pickPdfExportPath(suggestedName: string): Promise<string | null>;
  writePdfExport(path: string, pdfData: string): Promise<string>;
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
  setWindowMinSize(width: number, height: number): Promise<void>;
  startWindowDrag(): Promise<void>;
  setWindowBackgroundColor(color: string): Promise<void>;
  openNewWindow(): Promise<void>;
  runWindowAction(action: WindowAction): Promise<void>;
}

export type WindowAction = 'minimize' | 'toggleMaximize' | 'close';

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
  onOpenRecentWorkspace(path: string): void;
  onSave(): void;
  onSaveAs(): void;
  onCloseFile(): void;
  onCloseWindow(): void;
  onExportPdf(): void;
}
