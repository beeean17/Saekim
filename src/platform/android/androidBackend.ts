import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  copyImageToAssets,
  downloadImageToAssets,
  importImageBytesToAssets,
  openFileDialog,
  openFolderDialog,
  pickImagePath,
  readFile,
  readFolder,
  readFolderChildren,
  searchWorkspace,
  resolveImageSrc,
  saveFile,
  saveFileAs,
  takePendingOpenFiles,
} from '../common/tauri/fs';
import { isTauriRuntime } from '../common/tauri/invoke';
import {
  deleteDocumentDraft,
  loadBlockLayouts,
  loadSession,
  loadWorkspaceSession,
  saveBlockLayout,
  saveBlockLayouts,
  saveSession,
} from '../common/tauri/session';
import type {
  BackendAdapter,
  CloseDecision,
  CloseRequest,
  CloseRequestReason,
  ImageDownloadProgressPayload,
} from '../common/BackendAdapter';

const externalOpenEvent = 'saekim-open-external-files';
const imageDownloadProgressEvent = 'image-download-progress';
const closeRequestedEvent = 'saekim-close-requested';

export const androidBackend: BackendAdapter = {
  files: {
    openFileDialog,
    importPdf: unsupported('PDF import'),
    readFile,
    saveFile,
    saveFileAs,
  },
  folders: {
    openFolderDialog,
    readFolder,
    readFolderChildren,
    searchWorkspace,
  },
  images: {
    pickImagePath,
    resolveImageSrc,
    copyImageToAssets,
    importImageBytesToAssets,
    downloadImageToAssets,
  },
  metadata: {
    loadSession,
    saveSession,
    deleteDocumentDraft,
    loadWorkspaceSession,
    loadBlockLayouts,
    saveBlockLayout,
    saveBlockLayouts,
  },
  export: {
    pickPdfExportPath: unsupported('PDF target picker'),
    writePdfExport: unsupported('PDF write'),
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
    listenNativeMenuCommands: listenNoop,
    listenCloseRequests,
    confirmUnsavedChanges,
    respondToCloseRequest,
    setWindowMinSize: noop,
    startWindowDrag: noop,
    setWindowBackgroundColor: noop,
    openNewWindow: noop,
    runWindowAction: noop,
  },
};

async function noop(): Promise<void> {}

async function logEvent(scope: string, message: string, details?: unknown): Promise<void> {
  if (details === undefined) console.info(`[saekim:${scope}] ${message}`);
  else console.info(`[saekim:${scope}] ${message}`, details);
}

async function listenNoop(): Promise<() => void> {
  return () => {};
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

async function listenCloseRequests(handler: (request: CloseRequest) => void): Promise<() => void> {
  return getCurrentWindow().listen<CloseRequest>(closeRequestedEvent, (event) => handler(event.payload));
}

async function confirmUnsavedChanges(fileNames: readonly string[]): Promise<CloseDecision> {
  return invoke<CloseDecision>('confirm_unsaved_changes', { fileNames });
}

async function respondToCloseRequest(reason: CloseRequestReason, approved: boolean): Promise<void> {
  await invoke('respond_to_close_request', { reason, approved });
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
