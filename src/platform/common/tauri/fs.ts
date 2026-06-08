import { invokeCommand, isTauriRuntime } from './invoke';
import type { FileTreeNode, FolderPayload, OpenFilePayload } from '../../../types/workspace';

export async function openFileDialog(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invokeCommand<boolean>('open_file_dialog');
}

export async function openFolderDialog(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<string | null>('open_folder_dialog');
}

export async function pickImagePath(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<string | null>('pick_image_path');
}

export async function copyImageToAssets(sourcePath: string, currentFilePath: string): Promise<string> {
  return invokeCommand<string>('copy_image_to_assets', { sourcePath, currentFilePath });
}

export async function importImageBytesToAssets(bytes: number[], fileName: string | null, mimeType: string | null, currentFilePath: string): Promise<string> {
  return invokeCommand<string>('import_image_bytes_to_assets', { bytes, fileName, mimeType, currentFilePath });
}

export async function downloadImageToAssets(id: string, imageUrl: string, currentFilePath: string): Promise<string> {
  return invokeCommand<string>('download_image_to_assets', { id, imageUrl, currentFilePath });
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

export async function pickPdfExportPath(suggestedName: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invokeCommand<string | null>('pick_pdf_export_path', { suggestedName });
}

export async function writePdfExport(path: string, bytes: number[]): Promise<string> {
  return invokeCommand<string>('write_pdf_export', { path, bytes });
}
