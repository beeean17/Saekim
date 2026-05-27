import {
  copyImageToAssets,
  downloadImageToAssets,
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
