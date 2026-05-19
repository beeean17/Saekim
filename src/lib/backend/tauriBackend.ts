import { openFileDialog, openFolderDialog, readFile, readFolder, saveFile, saveFileAs } from '../tauri/fs';
import { loadSession, saveSession } from '../tauri/session';
import { getNativeTheme, setNativeTheme } from '../tauri/theme';
import type { BackendAdapter } from './types';

export const tauriBackend: BackendAdapter = {
  openFileDialog,
  openFolderDialog,
  readFile,
  readFolder,
  saveFile,
  saveFileAs,
  loadSession,
  saveSession,
  getTheme: getNativeTheme,
  setTheme: setNativeTheme,
};
