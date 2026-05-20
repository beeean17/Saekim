import { useEffect, useRef, useState } from 'react';
import { Backend } from '../lib/backend';
import { useSettingsStore } from '../store/settings';
import { useUIStore } from '../store/ui';
import { useWorkspaceStore } from '../store/workspace';
import type { AppSession } from '../types/session';

export function useSessionPersistence(): void {
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const rootPath = useWorkspaceStore((state) => state.rootPath);
  const tree = useWorkspaceStore((state) => state.tree);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const activeFileId = useWorkspaceStore((state) => state.activeFileId);
  const restoreWorkspace = useWorkspaceStore((state) => state.restoreWorkspace);

  const sidebarMode = useUIStore((state) => state.sidebarMode);
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
  const restoreSettings = useSettingsStore((state) => state.restoreSettings);

  useEffect(() => {
    let alive = true;
    void Backend.loadSession<AppSession>()
      .then((session) => {
        if (!alive || !session) return;
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
          activeFileId,
        },
        ui: {
          sidebarMode,
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
    loaded,
    openFiles,
    rootPath,
    sidebarMode,
    sidebarWidth,
    splitRatio,
    syncScroll,
    theme,
    toolbarExpanded,
    tree,
    viewMode,
  ]);
}
