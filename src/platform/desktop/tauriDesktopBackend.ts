import { invoke } from '@tauri-apps/api/core';
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
} from '../../lib/tauri/fs';
import { isTauriRuntime } from '../../lib/tauri/invoke';
import { loadBlockLayouts, loadSession, saveBlockLayout, saveSession } from '../../lib/tauri/session';
import type { BackendAdapter } from '../common/BackendAdapter';

export const tauriDesktopBackend: BackendAdapter = {
  files: {
    openFileDialog,
    importPdf,
    readFile,
    saveFile,
    saveFileAs,
  },
  folders: {
    openFolderDialog,
    readFolder,
    readFolderChildren,
  },
  images: {
    pickImagePath,
    copyImageToAssets,
    importImageBytesToAssets,
    downloadImageToAssets,
  },
  metadata: {
    loadSession,
    saveSession,
    loadBlockLayouts,
    saveBlockLayout,
  },
  export: {
    pickPdfExportPath,
    writePdfExport,
  },
  runtime: {
    isTauriRuntime,
    isExternalUrl,
    openExternalUrl,
  },
};

async function openExternalUrl(url: string): Promise<void> {
  if (!isExternalUrl(url)) return;
  await invoke('open_external_url', { url });
}

function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:', 'tel:', 'file:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
