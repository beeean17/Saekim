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
import { loadBlockLayouts, loadSession, saveBlockLayout, saveSession } from '../tauri/session';
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
  loadBlockLayouts,
  saveBlockLayout,
};
