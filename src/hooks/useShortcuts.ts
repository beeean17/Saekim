import { useEffect } from 'react';
import { dispatchShortcut, type CommandRegistry } from '../app/commands';

interface ShortcutHandlers {
  onNewFile: () => void;
  onNewWindow: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onPrint: () => void;
  onCloseFile: () => void;
  onCloseWindow: () => void;
}

export function useShortcuts(handlers: ShortcutHandlers, commands: CommandRegistry): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;

      if (event.key.toLowerCase() === 'n' && event.shiftKey) {
        event.preventDefault();
        handlers.onNewWindow();
      } else if (event.key.toLowerCase() === 'n') {
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
      if (event.key.toLowerCase() === 'w' && event.shiftKey) {
        event.preventDefault();
        handlers.onCloseWindow();
      } else if (event.key.toLowerCase() === 'w') {
        event.preventDefault();
        handlers.onCloseFile();
      }
      if (event.key.toLowerCase() === 'f') {
        if (dispatchShortcut(commands, 'mod+f')) event.preventDefault();
      }
      if (event.key.toLowerCase() === 'h') {
        if (dispatchShortcut(commands, 'mod+h')) event.preventDefault();
      }
      if (event.key.toLowerCase() === 'e' && event.shiftKey) {
        if (dispatchShortcut(commands, 'mod+shift+e')) event.preventDefault();
      }
      if (event.key.toLowerCase() === 'p' && !event.shiftKey) {
        event.preventDefault();
        handlers.onPrint();
      }
      if (/^[1-9]$/.test(event.key) && dispatchShortcut(commands, `mod+${event.key}`)) {
        event.preventDefault();
      }
      if (event.key.toLowerCase() === 't' && event.shiftKey) {
        if (dispatchShortcut(commands, 'mod+shift+t')) event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commands, handlers]);
}
