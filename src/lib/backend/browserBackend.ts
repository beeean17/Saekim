import type { BackendAdapter } from './types';
import type { FileTreeNode, FolderPayload, OpenFilePayload } from '../../types/workspace';

const sessionKey = 'saekim-browser-session';

export const browserBackend: BackendAdapter = {
  async openFileDialog(): Promise<OpenFilePayload | null> {
    return null;
  },

  async openFolderDialog(): Promise<string | null> {
    return null;
  },

  async pickImagePath(): Promise<string | null> {
    return null;
  },

  async importPdf(_path: string): Promise<OpenFilePayload> {
    throw new Error('PDF import is deferred in Saekim 3.0.0.');
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

  async readFolderChildren(_path: string): Promise<FileTreeNode[]> {
    return [];
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
};
