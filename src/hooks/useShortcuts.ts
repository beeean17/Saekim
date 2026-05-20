import { useEffect } from 'react';

interface ShortcutHandlers {
  onNewFile: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportPdf: () => void;
  onFind: () => void;
  onClose: () => void;
}

export function useShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handlers.onNewFile();
      }
      if (event.key.toLowerCase() === 'o' && event.shiftKey) {
        event.preventDefault();
        handlers.onOpenFolder();
      } else if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        handlers.onOpen();
      }
      if (event.key.toLowerCase() === 's' && event.shiftKey) {
        event.preventDefault();
        handlers.onSaveAs();
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        handlers.onSave();
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        handlers.onFind();
      }
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        handlers.onExportPdf();
      }
      if (event.key.toLowerCase() === 'w') {
        event.preventDefault();
        handlers.onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
