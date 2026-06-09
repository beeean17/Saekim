import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { EventCallback, EventTarget } from '@tauri-apps/api/event';
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
} from '../common/tauri/fs';
import { isTauriRuntime } from '../common/tauri/invoke';
import { loadBlockLayouts, loadSession, loadWorkspaceSession, saveBlockLayout, saveSession } from '../common/tauri/session';
import type { BackendAdapter, ImageDownloadProgressPayload, NativeMenuCommandHandlers, WindowAction } from '../common/BackendAdapter';

const externalOpenEvent = 'saekim-open-external-files';
const imageDownloadProgressEvent = 'image-download-progress';
const menuEvents = {
  newFile: 'saekim-menu-new-file',
  newWindow: 'saekim-menu-new-window',
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
    loadWorkspaceSession,
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
    logEvent,
    openExternalUrl,
    takePendingOpenFiles,
    listenExternalOpenFiles,
    listenImageDownloadProgress,
    listenNativeMenuCommands,
    setWindowMinSize,
    startWindowDrag,
    setWindowBackgroundColor,
    openNewWindow,
    runWindowAction,
  },
};

async function openExternalUrl(url: string): Promise<void> {
  if (!isExternalUrl(url)) return;
  await invoke('open_external_url', { url });
}

async function logEvent(scope: string, message: string, details?: unknown): Promise<void> {
  const renderedDetails = renderLogDetails(details);
  if (renderedDetails) console.info(`[saekim:${scope}] ${message}`, details);
  else console.info(`[saekim:${scope}] ${message}`);

  await invoke('log_frontend_event', {
    scope,
    message,
    details: renderedDetails,
  });
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
  const webviewWindow = getCurrentWebviewWindow();
  const registrations: Array<() => void> = [];
  const registerMenuEvent = async (eventName: string, command: string, handler: () => void): Promise<void> => {
    const dedupedHandler = dedupeNativeMenuHandler(command, handler);
    const tauriHandler = createTauriEventHandler(dedupedHandler);
    const eventRegistrations: Array<() => void> = [listenDomMenuEvent(eventName, dedupedHandler)];
    const channels = ['dom'];

    try {
      eventRegistrations.push(await listen(eventName, tauriHandler, { target: webviewWindowEventTarget(webviewWindow.label) }));
      channels.push(`webviewWindow:${webviewWindow.label}`);
    } catch (error) {
      logDesktopEvent('native-menu', 'tauri listener unavailable', { command, eventName, error: renderDesktopError(error) });
    }

    registrations.push(...eventRegistrations);
    logDesktopEvent('native-menu', 'listener registered', { command, eventName, channels });
  };

  try {
    await registerMenuEvent(menuEvents.newFile, 'newFile', handlers.onNewFile);
    await registerMenuEvent(menuEvents.newWindow, 'newWindow', handlers.onNewWindow);
    await registerMenuEvent(menuEvents.openFile, 'openFile', handlers.onOpen);
    await registerMenuEvent(menuEvents.openFolder, 'openFolder', handlers.onOpenFolder);
    await registerMenuEvent(menuEvents.save, 'save', handlers.onSave);
    await registerMenuEvent(menuEvents.saveAs, 'saveAs', handlers.onSaveAs);
    await registerMenuEvent(menuEvents.exportPdf, 'exportPdf', handlers.onExportPdf);
  } catch (error) {
    registrations.forEach((unlisten) => unlisten());
    throw error;
  }

  return () => registrations.forEach((unlisten) => unlisten());
}

function createTauriEventHandler(handler: () => void): EventCallback<void> {
  return () => handler();
}

function listenDomMenuEvent(eventName: string, handler: () => void): () => void {
  if (typeof globalThis.window === 'undefined') return () => {};

  const listener = () => handler();
  globalThis.window.addEventListener(eventName, listener);
  return () => globalThis.window.removeEventListener(eventName, listener);
}

function webviewWindowEventTarget(label: string): EventTarget {
  return { kind: 'WebviewWindow', label };
}

function renderDesktopError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? '',
    };
  }

  return { message: String(error) };
}

function dedupeNativeMenuHandler(command: string, handler: () => void): () => void {
  let lastHandledAt = 0;
  return () => {
    const now = Date.now();
    if (now - lastHandledAt < 100) {
      logDesktopEvent('native-menu', 'duplicate event ignored', { command });
      return;
    }

    lastHandledAt = now;
    logDesktopEvent('native-menu', 'event received', { command });
    handler();
  };
}

function logDesktopEvent(scope: string, message: string, details?: unknown): void {
  void logEvent(scope, message, details).catch((error) => {
    console.warn('failed to write desktop log event', error);
  });
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

async function openNewWindow(): Promise<void> {
  await invoke('open_new_window');
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

function renderLogDetails(details?: unknown): string | null {
  if (details === undefined || details === null) return null;
  if (typeof details === 'string') return details;

  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}
