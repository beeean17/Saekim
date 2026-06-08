import {
  copyImageToAssets,
  downloadImageToAssets,
  importImageBytesToAssets,
  importPdf,
  openFileDialog,
  openFolderDialog,
  pickPdfExportPath,
  pickImagePath,
  readFile,
  readFolder,
  readFolderChildren,
  saveFile,
  saveFileAs,
  writePdfExport,
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
  pickPdfExportPath,
  writePdfExport,
  loadSession,
  saveSession,
  loadBlockLayouts,
  saveBlockLayout,
};
