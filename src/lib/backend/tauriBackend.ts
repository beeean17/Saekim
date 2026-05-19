import { importPdf, openFileDialog, openFolderDialog, readFile, readFolder, readFolderChildren, saveFile, saveFileAs } from '../tauri/fs';
import { loadSession, saveSession } from '../tauri/session';
import { getNativeTheme, setNativeTheme } from '../tauri/theme';
import type { BackendAdapter } from './types';

export const tauriBackend: BackendAdapter = {
  openFileDialog,
  openFolderDialog,
  importPdf,
  readFile,
  readFolder,
  readFolderChildren,
  saveFile,
  saveFileAs,
  loadSession,
  saveSession,
  getTheme: getNativeTheme,
  setTheme: setNativeTheme,
};
