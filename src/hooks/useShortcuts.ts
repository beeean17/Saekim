import { useEffect } from 'react';
import { dispatchShortcut, type CommandRegistry } from '../app/commands';

interface ShortcutHandlers {
  onNewFile: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onClose: () => void;
}

export function useShortcuts(handlers: ShortcutHandlers, commands: CommandRegistry): void {
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
        if (dispatchShortcut(commands, 'mod+f')) event.preventDefault();
      }
      if (event.key.toLowerCase() === 'p') {
        if (dispatchShortcut(commands, 'mod+p')) event.preventDefault();
      }
      if (event.key.toLowerCase() === 'w') {
        event.preventDefault();
        handlers.onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commands, handlers]);
}
