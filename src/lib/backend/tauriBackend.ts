import {
  copyImageToAssets,
  downloadImageToAssets,
  importImageBytesToAssets,
  importPdf,
  openFileDialog,
  openFolderDialog,
  pickImagePath,
  readFile,
  readFolder,
  readFolderChildren,
  saveFile,
  saveFileAs,
} from '../tauri/fs';
import { loadSession, saveSession } from '../tauri/session';
import type { BackendAdapter } from './types';

export const tauriBackend: BackendAdapter = {
  openFileDialog,
  openFolderDialog,
  pickImagePath,
  copyImageToAssets,
  importImageBytesToAssets,
  downloadImageToAssets,
  importPdf,
  readFile,
  readFolder,
  readFolderChildren,
  saveFile,
  saveFileAs,
  loadSession,
  saveSession,
};
