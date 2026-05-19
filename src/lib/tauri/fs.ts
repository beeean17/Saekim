import { invokeCommand, isTauriRuntime } from './invoke';
import type { FolderPayload, OpenFilePayload } from '../../types/workspace';

export async function openFileDialog(): Promise<OpenFilePayload | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<OpenFilePayload | null>('open_file_dialog');
}

export async function openFolderDialog(): Promise<FolderPayload | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<FolderPayload | null>('open_folder_dialog');
}

export async function readFile(path: string): Promise<OpenFilePayload> {
  return invokeCommand<OpenFilePayload>('read_file', { path });
}

export async function readFolder(path: string): Promise<FolderPayload> {
  return invokeCommand<FolderPayload>('read_folder', { path });
}

export async function saveFile(path: string | null, content: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return path;
  }
  return invokeCommand<string | null>('save_file', { path, content });
}

export async function saveFileAs(content: string, suggestedName: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invokeCommand<string | null>('save_file_as', { content, suggestedName });
}
