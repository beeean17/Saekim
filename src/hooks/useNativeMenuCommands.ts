import { useEffect } from 'react';
import { Backend } from '../platform/common/backend';
import { currentPlatformCapabilities } from '../platform/common/capabilities';

interface NativeMenuHandlers {
  onNewFile: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportPdf: () => void;
}

const menuEvents = {
  newFile: 'saekim-menu-new-file',
  openFile: 'saekim-menu-open-file',
  openFolder: 'saekim-menu-open-folder',
  save: 'saekim-menu-save',
  saveAs: 'saekim-menu-save-as',
  exportPdf: 'saekim-menu-export-pdf',
} as const;

export function useNativeMenuCommands(handlers: NativeMenuHandlers): void {
  useEffect(() => {
    if (!Backend.runtime.isTauriRuntime() || !currentPlatformCapabilities().has('native.menu')) return;

    let disposed = false;
    const unlisteners: Array<() => void> = [];

    void import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        const registrations = await Promise.all([
          listen(menuEvents.newFile, handlers.onNewFile),
          listen(menuEvents.openFile, handlers.onOpen),
          listen(menuEvents.openFolder, handlers.onOpenFolder),
          listen(menuEvents.save, handlers.onSave),
          listen(menuEvents.saveAs, handlers.onSaveAs),
          listen(menuEvents.exportPdf, handlers.onExportPdf),
        ]);

        if (disposed) {
          registrations.forEach((unlisten) => unlisten());
          return;
        }

        unlisteners.push(...registrations);
      })
      .catch((error) => {
        console.error('네이티브 메뉴 연결 실패:', error);
      });

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [handlers]);
}
