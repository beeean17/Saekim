import type { FileTreeNode, FolderPayload, OpenFilePayload } from '../../types/workspace';

export interface BackendAdapter {
  openFileDialog(): Promise<boolean>;
  openFolderDialog(): Promise<string | null>;
  pickImagePath(): Promise<string | null>;
  importPdf(path: string): Promise<OpenFilePayload>;
  readFile(path: string): Promise<OpenFilePayload>;
  readFolder(path: string): Promise<FolderPayload>;
  readFolderChildren(path: string): Promise<FileTreeNode[]>;
  saveFile(path: string | null, content: string): Promise<string | null>;
  saveFileAs(content: string, suggestedName: string): Promise<string | null>;
  loadSession<T>(): Promise<T | null>;
  saveSession<T>(session: T): Promise<void>;
}
