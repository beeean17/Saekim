import type { CommandContribution, CommandRuntimeContext, SaekimFeature } from './feature';
import { isTextFieldOutsideEditor } from '../core/editor/textFieldFocus';

export type CommandRegistry = ReadonlyMap<string, CommandContribution>;

export function createCommandRegistry(features: SaekimFeature[], ctx: CommandRuntimeContext): CommandRegistry {
  const commands = new Map<string, CommandContribution>();
  const shortcuts = new Map<string, string>();

  for (const feature of features) {
    for (const command of feature.commands?.(ctx) ?? []) {
      if (commands.has(command.id)) {
        throw new Error(`Command "${command.id}" is already registered.`);
      }
      const shortcut = normalizeShortcut(command.defaultShortcut);
      const owner = shortcut ? shortcuts.get(shortcut) : undefined;
      if (owner) {
        throw new Error(`Shortcut "${command.defaultShortcut}" is registered by both "${owner}" and "${command.id}".`);
      }
      if (shortcut) shortcuts.set(shortcut, command.id);
      commands.set(command.id, command);
    }
  }

  return commands;
}

export function dispatchCommand(commands: CommandRegistry, id: string): boolean {
  const command = commands.get(id);
  if (!command) return false;
  if (command.isEnabled?.() === false) return false;
  void command.run();
  return true;
}

/**
 * Returns false when the key was left alone, so the caller must not cancel
 * the event: a disabled command, or one yielding to the focused `target`.
 */
export function dispatchShortcut(commands: CommandRegistry, shortcut: string, target: EventTarget | null = null): boolean {
  const normalized = normalizeShortcut(shortcut);
  for (const command of commands.values()) {
    if (normalizeShortcut(command.defaultShortcut) !== normalized) continue;
    if (command.yieldsToTextFields && isTextFieldOutsideEditor(target)) return false;
    if (command.isEnabled?.() === false) return false;
    void command.run();
    return true;
  }
  return false;
}

export function commandMenuItems(commands: CommandRegistry, section: string): CommandContribution[] {
  return Array.from(commands.values())
    .filter((command) => command.menu?.section === section)
    .sort((left, right) => (left.menu?.order ?? 0) - (right.menu?.order ?? 0));
}

/**
 * True on Apple platforms, where the command modifier is Cmd and Ctrl is
 * reserved for the system's own text-editing bindings.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  /*
   * The two sources spell it differently - userAgentData reports "macOS"
   * while the legacy field reports "MacIntel" - so match case-insensitively
   * against both rather than trusting either one's casing.
   */
  const candidates = [
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform,
    navigator.platform,
  ];
  return candidates.some((value) => /mac|iphone|ipad|ipod/i.test(value ?? ''));
}

export function formatShortcut(shortcut?: string): string | undefined {
  if (!shortcut) return undefined;
  const mac = isApplePlatform();
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return undefined;

  const parts = normalized.split('+');
  const key = parts[parts.length - 1];
  const has = (modifier: string) => parts.includes(modifier);

  /*
   * Modifiers are written in each platform's conventional order: Apple's is
   * Control, Option, Shift, Command (so ⌃⌘F, never ⌘⌃F), while Windows and
   * Linux write Ctrl, Alt, Shift.
   */
  const modifiers = mac
    ? [has('control') ? '⌃' : '', has('alt') ? '⌥' : '', has('shift') ? '⇧' : '', has('mod') ? '⌘' : '']
    : [has('mod') || has('control') ? 'Ctrl' : '', has('alt') ? 'Alt' : '', has('shift') ? 'Shift' : ''];

  return [...modifiers.filter(Boolean), formatShortcutKey(key)].join(mac ? '' : '+');
}

function formatShortcutKey(key: string): string {
  if (key === 'backslash') return '\\';
  if (isFunctionKey(key)) return key.toUpperCase();
  return key.length === 1 ? key.toUpperCase() : key;
}

/** F1-F12 are the one family of keys that work as a shortcut on their own. */
function isFunctionKey(key: string): boolean {
  return /^f([1-9]|1[0-2])$/.test(key);
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  const key = normalizeEventKey(event.key, event.code);
  if (!key) return null;

  /*
   * On macOS the command modifier is Cmd only. Treating Ctrl as equivalent
   * stole the system's Emacs-style text bindings inside the editor - Ctrl+H
   * opened Replace instead of deleting a character, Ctrl+K opened the palette
   * instead of killing to end of line.
   */
  const mac = isApplePlatform();
  const commandModifier = mac ? event.metaKey : event.ctrlKey;
  /* On macOS, Control is its own modifier and can pair with Command (⌃⌘F). */
  const controlModifier = mac && event.ctrlKey;

  /* A bare function key is a shortcut in its own right (F11 for full screen);
     everything else still needs the platform's command modifier. */
  if (!commandModifier && !(isFunctionKey(key) && !controlModifier && !event.altKey)) return null;

  return [
    commandModifier ? 'mod' : '',
    controlModifier ? 'control' : '',
    event.shiftKey ? 'shift' : '',
    event.altKey ? 'alt' : '',
    key,
  ]
    .filter(Boolean)
    .join('+');
}

function normalizeShortcut(shortcut?: string): string {
  if (!shortcut) return '';
  const parts = shortcut.trim().toLowerCase().split('+').filter(Boolean);
  const modifiers = ['mod', 'meta', 'cmd', 'ctrl', 'control', 'shift', 'alt', 'option'];
  const key = parts.find((part) => !modifiers.includes(part));
  if (!key) return '';
  return [
    parts.some((part) => ['mod', 'meta', 'cmd', 'ctrl'].includes(part)) ? 'mod' : '',
    parts.includes('control') ? 'control' : '',
    parts.includes('shift') ? 'shift' : '',
    parts.some((part) => ['alt', 'option'].includes(part)) ? 'alt' : '',
    key === '\\' ? 'backslash' : key,
  ]
    .filter(Boolean)
    .join('+');
}

function normalizeEventKey(key: string, code: string): string | null {
  if (['Meta', 'Control', 'Shift', 'Alt'].includes(key)) return null;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (code === 'Comma') return ',';
  if (code === 'Equal') return 'equal';
  if (code === 'Minus') return 'minus';
  if (code === 'Backslash') return 'backslash';
  if (key === '\\') return 'backslash';
  return key.toLowerCase();
}
