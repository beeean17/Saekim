import { invokeCommand, isTauriRuntime } from './invoke';
import type { OpenFilePayload } from '../../types/workspace';

export async function openFileDialog(): Promise<OpenFilePayload | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<OpenFilePayload | null>('open_file_dialog');
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
