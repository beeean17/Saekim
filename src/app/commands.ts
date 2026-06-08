import type { CommandContribution, CommandRuntimeContext, SaekimFeature } from './feature';

export type CommandRegistry = Map<string, CommandContribution>;

export function createCommandRegistry(features: SaekimFeature[], ctx: CommandRuntimeContext): CommandRegistry {
  const commands = new Map<string, CommandContribution>();

  for (const feature of features) {
    for (const command of feature.commands?.(ctx) ?? []) {
      if (commands.has(command.id)) {
        throw new Error(`Command "${command.id}" is already registered.`);
      }
      commands.set(command.id, {
        ...command,
        run: () => command.run(ctx),
      });
    }
  }

  return commands;
}

export function dispatchCommand(commands: CommandRegistry, id: string): boolean {
  const command = commands.get(id);
  if (!command) return false;
  void command.run(commandRuntimePlaceholder);
  return true;
}

export function dispatchShortcut(commands: CommandRegistry, shortcut: string): boolean {
  const normalized = normalizeShortcut(shortcut);
  for (const command of commands.values()) {
    if (normalizeShortcut(command.defaultShortcut) !== normalized) continue;
    void command.run(commandRuntimePlaceholder);
    return true;
  }
  return false;
}

export function commandMenuItems(commands: CommandRegistry, section: string): CommandContribution[] {
  return Array.from(commands.values()).filter((command) => command.menu?.section === section);
}

export function formatShortcut(shortcut?: string): string | undefined {
  return shortcut?.replace(/^mod/i, 'Ctrl').replace(/\+/g, '+');
}

function normalizeShortcut(shortcut?: string): string {
  return shortcut?.trim().toLowerCase() ?? '';
}

// Commands are already bound to runtime ctx by createCommandRegistry factories.
const commandRuntimePlaceholder = {} as CommandRuntimeContext;
