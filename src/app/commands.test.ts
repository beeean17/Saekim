import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommandContribution } from './feature';
import { dispatchCommand, dispatchShortcut, formatShortcut, shortcutFromKeyboardEvent, type CommandRegistry } from './commands';

function withPlatform(platform: string, run: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.navigator, 'platform');
  Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
  try {
    run();
  } finally {
    if (descriptor) Object.defineProperty(window.navigator, 'platform', descriptor);
  }
}

const keyZ = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', ...init });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('platform shortcuts', () => {
  it('uses Command on macOS and leaves Control to the system text bindings', () => {
    withPlatform('MacIntel', () => {
      expect(shortcutFromKeyboardEvent(keyZ({ metaKey: true }))).toBe('mod+z');
      /*
       * Ctrl+H, Ctrl+K and friends are standard macOS editing keys. Claiming
       * them for app commands broke deleting a character inside the editor.
       */
      expect(shortcutFromKeyboardEvent(keyZ({ ctrlKey: true }))).toBeNull();
    });
  });

  it('uses Control on Windows and Linux', () => {
    withPlatform('Win32', () => {
      expect(shortcutFromKeyboardEvent(keyZ({ ctrlKey: true }))).toBe('mod+z');
      expect(shortcutFromKeyboardEvent(keyZ({ metaKey: true }))).toBeNull();
    });
  });

  it('leaves the key free for other handlers while a command is disabled', () => {
    const run = vi.fn();
    let enabled = false;
    const command: CommandContribution = {
      id: 'file.undoCreate',
      label: 'Undo New File',
      defaultShortcut: 'mod+z',
      isEnabled: () => enabled,
      run,
    };
    const commands: CommandRegistry = new Map([[command.id, command]]);

    expect(dispatchCommand(commands, command.id)).toBe(false);
    expect(dispatchShortcut(commands, 'mod+z')).toBe(false);
    expect(run).not.toHaveBeenCalled();

    enabled = true;
    expect(dispatchShortcut(commands, 'mod+z')).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });

  it('leaves undo to a focused text field other than the document editor', () => {
    /*
     * Cmd+Z in a rename box or the find bar used to rewind the open document
     * instead of the field, and on a just-created empty file trashed it.
     */
    const run = vi.fn();
    const command: CommandContribution = {
      id: 'edit.undo',
      label: 'Undo',
      defaultShortcut: 'mod+z',
      yieldsToTextFields: true,
      run,
    };
    const commands: CommandRegistry = new Map([[command.id, command]]);
    const renameBox = document.createElement('input');
    const editor = document.createElement('textarea');
    editor.setAttribute('data-document-editor', '');

    expect(dispatchShortcut(commands, 'mod+z', renameBox)).toBe(false);
    expect(run).not.toHaveBeenCalled();

    expect(dispatchShortcut(commands, 'mod+z', editor)).toBe(true);
    expect(dispatchShortcut(commands, 'mod+z', document.createElement('button'))).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('apple platform detection', () => {
  it('recognises both spellings the browser uses for macOS', () => {
    /* userAgentData says "macOS", navigator.platform says "MacIntel". */
    withPlatform('macOS', () => {
      expect(shortcutFromKeyboardEvent(keyZ({ metaKey: true }))).toBe('mod+z');
    });
    withPlatform('MacIntel', () => {
      expect(shortcutFromKeyboardEvent(keyZ({ metaKey: true }))).toBe('mod+z');
    });
  });
});

describe('modifier combinations', () => {
  it('keeps Control+Command distinct from Command alone on macOS', () => {
    /*
     * ⌃⌘F is the system full-screen key. Folding Control into the command
     * modifier made it look identical to ⌘F, so pressing it opened Find.
     */
    withPlatform('MacIntel', () => {
      expect(
        shortcutFromKeyboardEvent(
          new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', metaKey: true, ctrlKey: true }),
        ),
      ).toBe('mod+control+f');
      expect(
        shortcutFromKeyboardEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', metaKey: true })),
      ).toBe('mod+f');
    });
  });

  it('accepts a bare function key as a shortcut', () => {
    withPlatform('Win32', () => {
      expect(shortcutFromKeyboardEvent(new KeyboardEvent('keydown', { code: 'F11', key: 'F11' }))).toBe('f11');
    });
  });

  it('still ignores unmodified letters', () => {
    withPlatform('Win32', () => {
      expect(shortcutFromKeyboardEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f' }))).toBeNull();
    });
  });

  it('renders each modifier with the platform glyph', () => {
    withPlatform('MacIntel', () => {
      expect(formatShortcut('mod+control+f')).toBe('⌃⌘F');
      expect(formatShortcut('f11')).toBe('F11');
    });
    withPlatform('Win32', () => {
      /* Control and the command modifier are the same key here, so it is
                 written once rather than twice. */
              expect(formatShortcut('mod+control+f')).toBe('Ctrl+F');
      expect(formatShortcut('f11')).toBe('F11');
    });
  });

  it('writes macOS modifiers in Apple order', () => {
    withPlatform('MacIntel', () => {
      expect(formatShortcut('mod+shift+s')).toBe('⇧⌘S');
      expect(formatShortcut('mod+alt+shift+p')).toBe('⌥⇧⌘P');
    });
  });
});
