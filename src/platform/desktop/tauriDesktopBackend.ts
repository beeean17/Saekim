import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { EventTarget } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  copyImageToAssets,
  createFolder,
  downloadImageToAssets,
  duplicateFile,
  importImageBytesToAssets,
  importPdf,
  openFileDialog,
  openFolderDialog,
  pickPdfExportPath,
  pickImagePath,
  readFile,
  readFolder,
  readFolderChildren,
  renameEntry,
  searchWorkspace,
  resolveImageSrc,
  saveFile,
  saveFileAs,
  takePendingOpenFiles,
  trashEntry,
  writePdfExport,
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
  NativeMenuCommandHandlers,
  WindowAction,
} from '../common/BackendAdapter';

const externalOpenEvent = 'saekim-open-external-files';
const imageDownloadProgressEvent = 'image-download-progress';
const closeRequestedEvent = 'saekim-close-requested';
const menuEvents = {
  newFile: 'saekim-menu-new-file',
  newWindow: 'saekim-menu-new-window',
  openFile: 'saekim-menu-open-file',
  openFolder: 'saekim-menu-open-folder',
  openRecentWorkspace: 'saekim-menu-open-recent-workspace',
  openRecentFile: 'saekim-menu-open-recent-file',
  save: 'saekim-menu-save',
  saveAs: 'saekim-menu-save-as',
  print: 'saekim-menu-print',
  closeFile: 'saekim-menu-close-file',
  closeWindow: 'saekim-menu-close-window',
  exportPdf: 'saekim-menu-export-pdf',
  find: 'saekim-menu-find',
  replace: 'saekim-menu-replace',
  zoomIn: 'saekim-menu-zoom-in',
  zoomOut: 'saekim-menu-zoom-out',
  zoomReset: 'saekim-menu-zoom-reset',
  openGitHub: 'saekim-menu-help-github',
  showShortcuts: 'saekim-menu-help-shortcuts',
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
    searchWorkspace,
    renameEntry,
    createFolder,
    duplicateFile,
    trashEntry,
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
    pickPdfExportPath,
    printWebviewPdf,
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
    listenCloseRequests,
    confirmUnsavedChanges,
    respondToCloseRequest,
    setWindowMinSize,
    startWindowDrag,
    setWindowBackgroundColor,
    setWindowDocumentState,
    openNewWindow,
    runWindowAction,
  },
};

async function printWebviewPdf(
  path: string,
  contentWidth: number,
  contentHeight: number,
): Promise<import('../common/BackendAdapter').NativePdfExportResult> {
  return invoke('print_webview_pdf', { path, contentWidth, contentHeight });
}

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

async function listenCloseRequests(handler: (request: CloseRequest) => void): Promise<() => void> {
  return getCurrentWindow().listen<CloseRequest>(closeRequestedEvent, (event) => handler(event.payload));
}

async function confirmUnsavedChanges(fileNames: readonly string[]): Promise<CloseDecision> {
  return invoke<CloseDecision>('confirm_unsaved_changes', { fileNames });
}

async function respondToCloseRequest(reason: CloseRequestReason, approved: boolean): Promise<void> {
  await invoke('respond_to_close_request', { reason, approved });
}

async function listenNativeMenuCommands(handlers: NativeMenuCommandHandlers): Promise<() => void> {
  const webviewWindow = getCurrentWebviewWindow();
  const registrations: Array<() => void> = [];
  const registerMenuEvent = async <T>(eventName: string, command: string, handler: (payload: T) => void): Promise<void> => {
    registrations.push(await listen<T>(eventName, (event) => {
      logDesktopEvent('native-menu', 'event received', { command });
      handler(event.payload);
    }, { target: webviewWindowEventTarget(webviewWindow.label) }));
    logDesktopEvent('native-menu', 'listener registered', {
      command,
      eventName,
      target: `webviewWindow:${webviewWindow.label}`,
    });
  };

  try {
    await registerMenuEvent<void>(menuEvents.newFile, 'newFile', () => handlers.onNewFile());
    await registerMenuEvent<void>(menuEvents.newWindow, 'newWindow', () => handlers.onNewWindow());
    await registerMenuEvent<void>(menuEvents.openFile, 'openFile', () => handlers.onOpen());
    await registerMenuEvent<void>(menuEvents.openFolder, 'openFolder', () => handlers.onOpenFolder());
    await registerMenuEvent<string>(menuEvents.openRecentFile, 'openRecentFile', handlers.onOpenRecentFile);
    await registerMenuEvent<string>(
      menuEvents.openRecentWorkspace,
      'openRecentWorkspace',
      handlers.onOpenRecentWorkspace,
    );
    await registerMenuEvent<void>(menuEvents.save, 'save', () => handlers.onSave());
    await registerMenuEvent<void>(menuEvents.saveAs, 'saveAs', () => handlers.onSaveAs());
    await registerMenuEvent<void>(menuEvents.print, 'print', () => handlers.onPrint());
    await registerMenuEvent<void>(menuEvents.closeFile, 'closeFile', () => handlers.onCloseFile());
    await registerMenuEvent<void>(menuEvents.closeWindow, 'closeWindow', () => handlers.onCloseWindow());
    await registerMenuEvent<void>(menuEvents.exportPdf, 'exportPdf', () => handlers.onExportPdf());
    await registerMenuEvent<void>(menuEvents.find, 'find', () => handlers.onFind());
    await registerMenuEvent<void>(menuEvents.replace, 'replace', () => handlers.onReplace());
    await registerMenuEvent<void>(menuEvents.zoomIn, 'zoomIn', () => handlers.onZoomIn());
    await registerMenuEvent<void>(menuEvents.zoomOut, 'zoomOut', () => handlers.onZoomOut());
    await registerMenuEvent<void>(menuEvents.zoomReset, 'zoomReset', () => handlers.onZoomReset());
    await registerMenuEvent<void>(menuEvents.openGitHub, 'openGitHub', () => handlers.onOpenGitHub());
    await registerMenuEvent<void>(menuEvents.showShortcuts, 'showShortcuts', () => handlers.onShowShortcuts());
  } catch (error) {
    registrations.forEach((unlisten) => unlisten());
    throw error;
  }

  return () => registrations.forEach((unlisten) => unlisten());
}

function webviewWindowEventTarget(label: string): EventTarget {
  return { kind: 'WebviewWindow', label };
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

async function setWindowDocumentState(title: string, edited: boolean, documentPath?: string): Promise<void> {
  await invoke('set_window_document_state', { title, edited, documentPath });
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
