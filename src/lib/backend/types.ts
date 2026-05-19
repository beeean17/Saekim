import type { OpenFilePayload, ThemeName } from '../../types/workspace';

export interface BackendAdapter {
  openFileDialog(): Promise<OpenFilePayload | null>;
  saveFile(path: string | null, content: string): Promise<string | null>;
  saveFileAs(content: string, suggestedName: string): Promise<string | null>;
  loadSession<T>(): Promise<T | null>;
  saveSession<T>(session: T): Promise<void>;
  getTheme(): Promise<ThemeName | null>;
  setTheme(theme: ThemeName): Promise<void>;
}
