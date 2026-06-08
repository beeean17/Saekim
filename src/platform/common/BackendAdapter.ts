import type { BlockLayout } from '../../types/metadata';
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
  openFileDialog(): Promise<boolean>;
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
  pickImagePath(): Promise<string | null>;
  copyImageToAssets(sourcePath: string, currentFilePath: string): Promise<string>;
  importImageBytesToAssets(bytes: number[], fileName: string | null, mimeType: string | null, currentFilePath: string): Promise<string>;
  downloadImageToAssets(id: string, imageUrl: string, currentFilePath: string): Promise<string>;
}

export interface MetadataBackend {
  loadSession<T>(): Promise<T | null>;
  saveSession<T>(session: T): Promise<void>;
  loadBlockLayouts(filePath: string): Promise<BlockLayout[]>;
  saveBlockLayout(layout: BlockLayout): Promise<void>;
}

export interface ExportBackend {
  pickPdfExportPath(suggestedName: string): Promise<string | null>;
  writePdfExport(path: string, bytes: number[]): Promise<string>;
}

export interface RuntimeBackend {
  isTauriRuntime(): boolean;
  isExternalUrl(url: string): boolean;
  openExternalUrl(url: string): Promise<void>;
  setWindowMinSize(width: number, height: number): Promise<void>;
  startWindowDrag(): Promise<void>;
  setWindowBackgroundColor(color: string): Promise<void>;
  runWindowAction(action: WindowAction): Promise<void>;
}

export type WindowAction = 'minimize' | 'toggleMaximize' | 'close';
