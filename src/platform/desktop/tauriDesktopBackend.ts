import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
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
  takePendingOpenFiles,
  writePdfExport,
} from '../../lib/tauri/fs';
import { isTauriRuntime } from '../../lib/tauri/invoke';
import { loadBlockLayouts, loadSession, saveBlockLayout, saveSession } from '../../lib/tauri/session';
import type { BackendAdapter, ImageDownloadProgressPayload, NativeMenuCommandHandlers, WindowAction } from '../common/BackendAdapter';

const externalOpenEvent = 'saekim-open-external-files';
const imageDownloadProgressEvent = 'image-download-progress';
const menuEvents = {
  newFile: 'saekim-menu-new-file',
  openFile: 'saekim-menu-open-file',
  openFolder: 'saekim-menu-open-folder',
  save: 'saekim-menu-save',
  saveAs: 'saekim-menu-save-as',
  exportPdf: 'saekim-menu-export-pdf',
} as const;

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
    toFileSrc: convertFileSrc,
    openExternalUrl,
    takePendingOpenFiles,
    listenExternalOpenFiles,
    listenImageDownloadProgress,
    listenNativeMenuCommands,
    setWindowMinSize,
    startWindowDrag,
    setWindowBackgroundColor,
    runWindowAction,
  },
};

async function openExternalUrl(url: string): Promise<void> {
  if (!isExternalUrl(url)) return;
  await invoke('open_external_url', { url });
}

async function listenExternalOpenFiles(handler: (paths: string[]) => void): Promise<() => void> {
  const unlisteners: Array<() => void> = [];
  unlisteners.push(await listen<string[]>(externalOpenEvent, (event) => handler(event.payload)));
  unlisteners.push(await getCurrentWindow().listen<string[]>(externalOpenEvent, (event) => handler(event.payload)));
  return () => unlisteners.forEach((unlisten) => unlisten());
}

async function listenImageDownloadProgress(handler: (payload: ImageDownloadProgressPayload) => void): Promise<() => void> {
  return listen<ImageDownloadProgressPayload>(imageDownloadProgressEvent, (event) => handler(event.payload));
}

async function listenNativeMenuCommands(handlers: NativeMenuCommandHandlers): Promise<() => void> {
  const registrations = await Promise.all([
    listen(menuEvents.newFile, handlers.onNewFile),
    listen(menuEvents.openFile, handlers.onOpen),
    listen(menuEvents.openFolder, handlers.onOpenFolder),
    listen(menuEvents.save, handlers.onSave),
    listen(menuEvents.saveAs, handlers.onSaveAs),
    listen(menuEvents.exportPdf, handlers.onExportPdf),
  ]);
  return () => registrations.forEach((unlisten) => unlisten());
}

async function setWindowMinSize(width: number, height: number): Promise<void> {
  await invoke('set_window_min_size', { width, height });
}

async function startWindowDrag(): Promise<void> {
  await invoke('start_window_drag');
}

async function setWindowBackgroundColor(color: string): Promise<void> {
  await getCurrentWebviewWindow().setBackgroundColor(color);
}

async function runWindowAction(action: WindowAction): Promise<void> {
  const window = getCurrentWebviewWindow();
  await window[action]();
}

function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:', 'tel:', 'file:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
