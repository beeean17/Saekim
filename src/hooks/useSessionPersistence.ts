import { useEffect, useRef, useState } from 'react';
import { Backend } from '../platform/common/backend';
import { useSettingsStore } from '../store/settings';
import { useUIStore } from '../store/ui';
import { useWorkspaceStore } from '../store/workspace';
import type { AppSession, SettingsSession, UISession } from '../types/session';

const legacyLocalStorageKeys = ['saekim-ui', 'saekim-settings'];

interface LegacyPersistedState<T> {
  state?: Partial<T>;
}

interface LegacyMetadata {
  settings: SettingsSession | null;
  ui: UISession | null;
}

function readLegacyPersistedState<T>(key: string): Partial<T> | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    return (JSON.parse(raw) as LegacyPersistedState<T>).state ?? null;
  } catch {
    return null;
  }
}

function readLegacyMetadata(): LegacyMetadata {
  const settings = readLegacyPersistedState<SettingsSession>('saekim-settings');
  const ui = readLegacyPersistedState<UISession>('saekim-ui');

  return {
    settings:
      settings?.theme && typeof settings.fontSize === 'number' && settings.editorFontFamily
        ? {
            theme: settings.theme,
            fontSize: settings.fontSize,
            editorFontFamily: settings.editorFontFamily,
            htmlPreviewMode: settings.htmlPreviewMode,
            showLineNumbers: settings.showLineNumbers,
          }
        : null,
    ui:
      ui?.sidebarMode && ui.viewMode && typeof ui.sidebarWidth === 'number'
        ? {
            sidebarMode: ui.sidebarMode,
            viewMode: ui.viewMode,
            sidebarWidth: ui.sidebarWidth,
            splitRatio: typeof ui.splitRatio === 'number' ? ui.splitRatio : 0.5,
            editorWidth: ui.editorWidth,
            syncScroll: ui.syncScroll ?? true,
          }
        : null,
  };
}

function clearLegacyLocalStorage(): void {
  if (!Backend.runtime.isTauriRuntime()) return;
  for (const key of legacyLocalStorageKeys) {
    window.localStorage.removeItem(key);
  }
}

function buildSession(): AppSession {
  const workspace = useWorkspaceStore.getState();
  const ui = useUIStore.getState();
  const settings = useSettingsStore.getState();

  return {
    version: 3,
    savedAt: new Date().toISOString(),
    window: {
      id: 'browser-window',
      label: 'browser-window',
    },
    workspace: {
      rootPath: workspace.rootPath,
      tree: workspace.tree,
      openFiles: workspace.openFiles,
      activeFileId: workspace.activeFileId,
    },
    recentWorkspaces: workspace.recentWorkspaces,
    ui: {
      sidebarMode: ui.sidebarMode,
      viewMode: ui.viewMode,
      sidebarWidth: ui.sidebarWidth,
      splitRatio: ui.splitRatio,
      editorWidth: ui.editorWidth,
      syncScroll: ui.syncScroll,
    },
    settings: {
      theme: settings.theme,
      fontSize: settings.fontSize,
      editorFontFamily: settings.editorFontFamily,
      htmlPreviewMode: settings.htmlPreviewMode,
      showLineNumbers: settings.showLineNumbers,
    },
  };
}

function saveSession(scope: 'ui' | 'documents'): void {
  void Backend.metadata.saveSession(buildSession(), scope).catch((error) => {
    console.error('세션 저장 실패:', error);
  });
}

export function useSessionPersistence(): boolean {
  const [loaded, setLoaded] = useState(false);
  const uiSaveTimer = useRef<number | null>(null);
  const documentSaveTimer = useRef<number | null>(null);

  const rootPath = useWorkspaceStore((state) => state.rootPath);
  const tree = useWorkspaceStore((state) => state.tree);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const recentWorkspaces = useWorkspaceStore((state) => state.recentWorkspaces);
  const activeFileId = useWorkspaceStore((state) => state.activeFileId);
  const restoreWorkspace = useWorkspaceStore((state) => state.restoreWorkspace);
  const restoreRecentWorkspaces = useWorkspaceStore((state) => state.restoreRecentWorkspaces);

  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const viewMode = useUIStore((state) => state.viewMode);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const splitRatio = useUIStore((state) => state.splitRatio);
  const editorWidth = useUIStore((state) => state.editorWidth);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const restoreUI = useUIStore((state) => state.restoreUI);

  const theme = useSettingsStore((state) => state.theme);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const editorFontFamily = useSettingsStore((state) => state.editorFontFamily);
  const htmlPreviewMode = useSettingsStore((state) => state.htmlPreviewMode);
  const showLineNumbers = useSettingsStore((state) => state.showLineNumbers);
  const restoreSettings = useSettingsStore((state) => state.restoreSettings);

  useEffect(() => {
    let alive = true;
    const legacyMetadata = Backend.runtime.isTauriRuntime() ? readLegacyMetadata() : null;
    clearLegacyLocalStorage();

    void Backend.metadata.loadSession<AppSession>()
      .then((session) => {
        if (!alive) return;
        if (!session) {
          if (legacyMetadata?.ui) restoreUI(legacyMetadata.ui);
          if (legacyMetadata?.settings) restoreSettings(legacyMetadata.settings);
          return;
        }
        restoreWorkspace(session.workspace);
        restoreRecentWorkspaces(session.recentWorkspaces);
        restoreUI(session.ui);
        restoreSettings(session.settings);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [restoreRecentWorkspaces, restoreSettings, restoreUI, restoreWorkspace]);

  useEffect(() => {
    if (!loaded) return;
    if (uiSaveTimer.current) {
      window.clearTimeout(uiSaveTimer.current);
    }

    uiSaveTimer.current = window.setTimeout(() => {
      saveSession('ui');
    }, 400);

    return () => {
      if (uiSaveTimer.current) {
        window.clearTimeout(uiSaveTimer.current);
      }
    };
  }, [
    editorFontFamily,
    editorWidth,
    fontSize,
    htmlPreviewMode,
    loaded,
    sidebarMode,
    sidebarWidth,
    showLineNumbers,
    splitRatio,
    syncScroll,
    theme,
    viewMode,
  ]);

  useEffect(() => {
    if (!loaded) return;
    if (documentSaveTimer.current) {
      window.clearTimeout(documentSaveTimer.current);
    }

    documentSaveTimer.current = window.setTimeout(() => {
      saveSession('documents');
    }, 2_000);

    return () => {
      if (documentSaveTimer.current) {
        window.clearTimeout(documentSaveTimer.current);
      }
    };
  }, [activeFileId, loaded, openFiles, recentWorkspaces, rootPath, tree]);

  useEffect(() => {
    if (!loaded) return;

    const flushDocuments = () => {
      if (documentSaveTimer.current) {
        window.clearTimeout(documentSaveTimer.current);
        documentSaveTimer.current = null;
      }
      saveSession('documents');
    };
    window.addEventListener('blur', flushDocuments);
    return () => window.removeEventListener('blur', flushDocuments);
  }, [loaded]);

  return loaded;
}
