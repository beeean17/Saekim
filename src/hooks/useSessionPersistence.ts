import { useEffect, useRef, useState } from 'react';
import { Backend } from '../lib/backend';
import { isTauriRuntime } from '../lib/tauri/invoke';
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
          }
        : null,
    ui:
      ui?.sidebarMode && ui.toolbarExpanded !== undefined && ui.viewMode && typeof ui.sidebarWidth === 'number'
        ? {
            sidebarMode: ui.sidebarMode,
            toolbarExpanded: ui.toolbarExpanded,
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
  if (!isTauriRuntime()) return;
  for (const key of legacyLocalStorageKeys) {
    window.localStorage.removeItem(key);
  }
}

export function useSessionPersistence(): boolean {
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const rootPath = useWorkspaceStore((state) => state.rootPath);
  const tree = useWorkspaceStore((state) => state.tree);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const recentFiles = useWorkspaceStore((state) => state.recentFiles);
  const activeFileId = useWorkspaceStore((state) => state.activeFileId);
  const restoreWorkspace = useWorkspaceStore((state) => state.restoreWorkspace);

  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const sidebarViewMode = useUIStore((state) => state.sidebarViewMode);
  const toolbarExpanded = useUIStore((state) => state.toolbarExpanded);
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
  const restoreSettings = useSettingsStore((state) => state.restoreSettings);

  useEffect(() => {
    let alive = true;
    const legacyMetadata = isTauriRuntime() ? readLegacyMetadata() : null;
    clearLegacyLocalStorage();

    void Backend.loadSession<AppSession>()
      .then((session) => {
        if (!alive) return;
        if (!session) {
          if (legacyMetadata?.ui) restoreUI(legacyMetadata.ui);
          if (legacyMetadata?.settings) restoreSettings(legacyMetadata.settings);
          return;
        }
        restoreWorkspace(session.workspace);
        restoreUI(session.ui);
        restoreSettings(session.settings);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [restoreSettings, restoreUI, restoreWorkspace]);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }

    saveTimer.current = window.setTimeout(() => {
      const session: AppSession = {
        version: 1,
        savedAt: new Date().toISOString(),
        workspace: {
          rootPath,
          tree,
          openFiles,
          recentFiles,
          activeFileId,
        },
        ui: {
          sidebarMode,
          sidebarViewMode,
          toolbarExpanded,
          viewMode,
          sidebarWidth,
          splitRatio,
          editorWidth,
          syncScroll,
        },
        settings: {
          theme,
          fontSize,
          editorFontFamily,
          htmlPreviewMode,
        },
      };

      void Backend.saveSession(session);
    }, 400);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [
    activeFileId,
    editorFontFamily,
    editorWidth,
    fontSize,
    htmlPreviewMode,
    loaded,
    openFiles,
    recentFiles,
    rootPath,
    sidebarMode,
    sidebarViewMode,
    sidebarWidth,
    splitRatio,
    syncScroll,
    theme,
    toolbarExpanded,
    tree,
    viewMode,
  ]);

  return loaded;
}
