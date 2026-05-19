import { useEffect } from 'react';

interface ShortcutHandlers {
  onOpen: () => void;
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

      if (event.key.toLowerCase() === 'o') {
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
