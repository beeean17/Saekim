import type { FolderPayload, OpenFilePayload, ThemeName } from '../../types/workspace';

export interface BackendAdapter {
  openFileDialog(): Promise<OpenFilePayload | null>;
  openFolderDialog(): Promise<string | null>;
  readFile(path: string): Promise<OpenFilePayload>;
  readFolder(path: string): Promise<FolderPayload>;
  saveFile(path: string | null, content: string): Promise<string | null>;
  saveFileAs(content: string, suggestedName: string): Promise<string | null>;
  loadSession<T>(): Promise<T | null>;
  saveSession<T>(session: T): Promise<void>;
  getTheme(): Promise<ThemeName | null>;
  setTheme(theme: ThemeName): Promise<void>;
}
