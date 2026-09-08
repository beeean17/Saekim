import { useEffect } from 'react';
import { dispatchShortcut, shortcutFromKeyboardEvent, type CommandRegistry } from '../app/commands';

export function useShortcuts(commands: CommandRegistry): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat) return;
      const shortcut = shortcutFromKeyboardEvent(event);
      if (shortcut && dispatchShortcut(commands, shortcut)) event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commands]);
}
