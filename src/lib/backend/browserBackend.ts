import type { BackendAdapter } from './types';
import type { BlockLayout } from '../../types/metadata';
import type { FileTreeNode, FolderPayload, OpenFilePayload } from '../../types/workspace';

const sessionKey = 'saekim-browser-session';
const blockLayoutPrefix = 'saekim-block-layouts:';

export const browserBackend: BackendAdapter = {
  async openFileDialog(): Promise<boolean> {
    return false;
  },

  async openFolderDialog(): Promise<string | null> {
    return null;
  },

  async pickImagePath(): Promise<string | null> {
    return null;
  },

  async copyImageToAssets(_sourcePath: string, _currentFilePath: string): Promise<string> {
    throw new Error('Image asset import is only available in the desktop app.');
  },

  async importImageBytesToAssets(_bytes: number[], _fileName: string | null, _mimeType: string | null, _currentFilePath: string): Promise<string> {
    throw new Error('Dropped image import is only available in the desktop app.');
  },

  async downloadImageToAssets(_id: string, _imageUrl: string, _currentFilePath: string): Promise<string> {
    throw new Error('Remote image import is only available in the desktop app.');
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

  async loadBlockLayouts(filePath: string): Promise<BlockLayout[]> {
    const raw = localStorage.getItem(`${blockLayoutPrefix}${filePath}`);
    return raw ? (JSON.parse(raw) as BlockLayout[]) : [];
  },

  async saveBlockLayout(layout: BlockLayout): Promise<void> {
    const key = `${blockLayoutPrefix}${layout.filePath}`;
    const existing = await this.loadBlockLayouts(layout.filePath);
    const next = existing.filter(
      (item) =>
        item.blockKind !== layout.blockKind ||
        item.blockKey !== layout.blockKey ||
        item.occurrenceIndex !== layout.occurrenceIndex,
    );
    next.push(layout);
    localStorage.setItem(key, JSON.stringify(next));
  },
};
