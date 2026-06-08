import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import {
  openFileDialog,
  readFile,
  saveFile,
  saveFileAs,
} from '../../lib/tauri/fs';
import { isTauriRuntime } from '../../lib/tauri/invoke';
import { loadBlockLayouts, loadSession, saveBlockLayout, saveSession } from '../../lib/tauri/session';
import type { BackendAdapter } from '../common/BackendAdapter';

export const androidBackend: BackendAdapter = {
  files: {
    openFileDialog,
    importPdf: unsupported('PDF import'),
    readFile,
    saveFile,
    saveFileAs,
  },
  folders: {
    openFolderDialog: unsupported('Folder picker'),
    readFolder: unsupported('Folder read'),
    readFolderChildren: unsupported('Folder tree'),
  },
  images: {
    pickImagePath: unsupported('Image picker'),
    copyImageToAssets: unsupported('Image asset copy'),
    importImageBytesToAssets: unsupported('Image byte import'),
    downloadImageToAssets: unsupported('Remote image import'),
  },
  metadata: {
    loadSession,
    saveSession,
    loadBlockLayouts,
    saveBlockLayout,
  },
  export: {
    pickPdfExportPath: unsupported('PDF target picker'),
    writePdfExport: unsupported('PDF write'),
  },
  runtime: {
    isTauriRuntime,
    isExternalUrl,
    toFileSrc: convertFileSrc,
    openExternalUrl,
    takePendingOpenFiles: async () => [],
    listenExternalOpenFiles: listenNoop,
    listenImageDownloadProgress: listenNoop,
    listenNativeMenuCommands: listenNoop,
    setWindowMinSize: noop,
    startWindowDrag: noop,
    setWindowBackgroundColor: noop,
    runWindowAction: noop,
  },
};

async function noop(): Promise<void> {}

async function listenNoop(): Promise<() => void> {
  return () => {};
}

function unsupported<T>(capability: string): (..._args: unknown[]) => Promise<T> {
  return async () => {
    throw new Error(`${capability} is not implemented in the Android reference adapter yet.`);
  };
}

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
