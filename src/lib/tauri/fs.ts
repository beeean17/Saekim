import { invokeCommand, isTauriRuntime } from './invoke';
import type { FileTreeNode, FolderPayload, OpenFilePayload } from '../../types/workspace';

export async function openFileDialog(): Promise<OpenFilePayload | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<OpenFilePayload | null>('open_file_dialog');
}

export async function openFolderDialog(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<string | null>('open_folder_dialog');
}

export async function importPdf(path: string): Promise<OpenFilePayload> {
  return invokeCommand<OpenFilePayload>('import_pdf', { path });
}

export async function readFile(path: string): Promise<OpenFilePayload> {
  return invokeCommand<OpenFilePayload>('read_file', { path });
}

export async function takePendingOpenFiles(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return invokeCommand<string[]>('take_pending_open_files');
}

export async function readFolder(path: string): Promise<FolderPayload> {
  return invokeCommand<FolderPayload>('read_folder', { path });
}

export async function readFolderChildren(path: string): Promise<FileTreeNode[]> {
  return invokeCommand<FileTreeNode[]>('read_folder_children', { path });
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
