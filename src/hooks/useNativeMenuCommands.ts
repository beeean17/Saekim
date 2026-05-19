import { useEffect } from 'react';
import { isTauriRuntime } from '../lib/tauri/invoke';

interface NativeMenuHandlers {
  onSave: () => void;
  onSaveAs: () => void;
  onExportPdf: () => void;
}

const menuEvents = {
  save: 'saekim-menu-save',
  saveAs: 'saekim-menu-save-as',
  exportPdf: 'saekim-menu-export-pdf',
} as const;

export function useNativeMenuCommands(handlers: NativeMenuHandlers): void {
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    const unlisteners: Array<() => void> = [];

    void import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        const registrations = await Promise.all([
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
