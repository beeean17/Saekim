import type { CommandContribution, CommandRuntimeContext, SaekimFeature } from './feature';

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
  if (command.isEnabled?.() !== false) void command.run();
  return true;
}

export function dispatchShortcut(commands: CommandRegistry, shortcut: string): boolean {
  const normalized = normalizeShortcut(shortcut);
  for (const command of commands.values()) {
    if (normalizeShortcut(command.defaultShortcut) !== normalized) continue;
    if (command.isEnabled?.() !== false) void command.run();
    return true;
  }
  return false;
}

export function commandMenuItems(commands: CommandRegistry, section: string): CommandContribution[] {
  return Array.from(commands.values())
    .filter((command) => command.menu?.section === section)
    .sort((left, right) => (left.menu?.order ?? 0) - (right.menu?.order ?? 0));
}

export function formatShortcut(shortcut?: string): string | undefined {
  if (!shortcut) return undefined;
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return normalizeShortcut(shortcut)
    .split('+')
    .map((part) => {
      if (part === 'mod') return mac ? '⌘' : 'Ctrl';
      if (part === 'shift') return mac ? '⇧' : 'Shift';
      if (part === 'alt') return mac ? '⌥' : 'Alt';
      if (part === 'backslash') return '\\';
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join(mac ? '' : '+');
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  const key = normalizeEventKey(event.key, event.code);
  if (!key || (!event.metaKey && !event.ctrlKey)) return null;

  return ['mod', event.shiftKey ? 'shift' : '', event.altKey ? 'alt' : '', key].filter(Boolean).join('+');
}

function normalizeShortcut(shortcut?: string): string {
  if (!shortcut) return '';
  const parts = shortcut.trim().toLowerCase().split('+').filter(Boolean);
  const key = parts.find((part) => !['mod', 'meta', 'cmd', 'ctrl', 'shift', 'alt', 'option'].includes(part));
  if (!key) return '';
  return [
    parts.some((part) => ['mod', 'meta', 'cmd', 'ctrl'].includes(part)) ? 'mod' : '',
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
  if (code === 'Backslash') return 'backslash';
  if (key === '\\') return 'backslash';
  return key.toLowerCase();
}
