import type { BackendAdapter } from './types';
import type { FolderPayload, OpenFilePayload, ThemeName } from '../../types/workspace';

const sessionKey = 'saekim-browser-session';
const themeKey = 'saekim-browser-theme';

export const browserBackend: BackendAdapter = {
  async openFileDialog(): Promise<OpenFilePayload | null> {
    return null;
  },

  async openFolderDialog(): Promise<FolderPayload | null> {
    return null;
  },

  async readFile(path: string): Promise<OpenFilePayload> {
    const content = localStorage.getItem(`saekim-file:${path}`) ?? '';
    return {
      path,
      name: path.split('/').pop() || 'untitled.md',
      content,
    };
  },

  async readFolder(path: string): Promise<FolderPayload> {
    return {
      rootPath: path,
      tree: [],
    };
  },

  async saveFile(path: string | null, content: string): Promise<string | null> {
    if (!path) return this.saveFileAs(content, 'untitled.md');
    localStorage.setItem(`saekim-file:${path}`, content);
    return path;
  },

  async saveFileAs(content: string, suggestedName: string): Promise<string | null> {
    const path = `browser://${suggestedName || 'untitled.md'}`;
    localStorage.setItem(`saekim-file:${path}`, content);
    return path;
  },

  async loadSession<T>(): Promise<T | null> {
    const raw = localStorage.getItem(sessionKey);
    return raw ? (JSON.parse(raw) as T) : null;
  },

  async saveSession<T>(session: T): Promise<void> {
    localStorage.setItem(sessionKey, JSON.stringify(session));
  },

  async getTheme(): Promise<ThemeName | null> {
    return (localStorage.getItem(themeKey) as ThemeName | null) ?? null;
  },

  async setTheme(theme: ThemeName): Promise<void> {
    localStorage.setItem(themeKey, theme);
  },
};
