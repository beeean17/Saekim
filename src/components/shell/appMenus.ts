import { commandMenuItems, dispatchCommand, formatShortcut, type CommandRegistry } from '../../app/commands';
import { Backend } from '../../platform/common/backend';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';
import type { CommandContribution } from '../../app/feature';
import type { ViewMode } from '../../types/workspace';

export type AppMenuId = 'file' | 'edit' | 'view' | 'window' | 'help';

export interface AppMenuItem {
  label?: string;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  separator?: boolean;
  action?: () => void;
}

export interface AppMenuGroup {
  id: AppMenuId;
  label: string;
  items: AppMenuItem[];
}

export interface BuildAppMenusOptions {
  commandRegistry: CommandRegistry;
  viewMode: ViewMode;
  effectiveViewMode: ViewMode;
  syncScroll: boolean;
  toggleSyncScroll: () => void;
  getDocumentCommandTarget: () => HTMLElement | null;
  includeWindowMenu?: boolean;
}

export function buildAppMenus({
  commandRegistry,
  viewMode,
  effectiveViewMode,
  syncScroll,
  toggleSyncScroll,
  getDocumentCommandTarget,
  includeWindowMenu = currentPlatformCapabilities().has('window.chrome'),
}: BuildAppMenusOptions): AppMenuGroup[] {
  const fileItems = registeredMenuItems(commandRegistry, 'file');
  const editItems = registeredMenuItems(commandRegistry, 'edit');
  const viewItems = registeredMenuItems(commandRegistry, 'view').map((item) => ({
    ...item,
    checked: item.commandId === `view.${effectiveViewMode}` ? true : item.checked,
  }));
  const menus: AppMenuGroup[] = [
    {
      id: 'file',
      label: 'File',
      items: includeWindowMenu ? fileItems : fileItems.filter((item) => item.commandId !== 'window.new'),
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => runDocumentCommand('undo', getDocumentCommandTarget()) },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => runDocumentCommand('redo', getDocumentCommandTarget()) },
        { separator: true },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => runDocumentCommand('cut', getDocumentCommandTarget()) },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => runDocumentCommand('copy', getDocumentCommandTarget()) },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => void runPasteCommand(getDocumentCommandTarget()) },
        { separator: true },
        ...editItems,
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => runDocumentCommand('selectAll', getDocumentCommandTarget()) },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        ...viewItems,
        ...(viewMode === 'split' && effectiveViewMode === 'split'
          ? [{ separator: true }, { label: 'Sync Scroll', checked: syncScroll, action: toggleSyncScroll }]
          : []),
      ],
    },
  ];

  if (includeWindowMenu) {
    menus.push({
      id: 'window',
      label: 'Window',
      items: [
        { label: 'Minimize', action: () => void runWindowAction('minimize') },
        { label: 'Maximize / Restore', action: () => void runWindowAction('toggleMaximize') },
        ...withLeadingSeparator(registeredMenuItems(commandRegistry, 'window')),
      ],
    });
  }

  menus.push({
    id: 'help',
    label: 'Help',
    items: [{ label: 'About Saekim', action: () => window.alert(`Saekim ${__APP_VERSION__}`) }],
  });

  return menus;
}

interface RegisteredMenuItem extends AppMenuItem {
  commandId?: string;
}

function registeredMenuItems(commandRegistry: CommandRegistry, section: string): RegisteredMenuItem[] {
  const items: RegisteredMenuItem[] = [];
  let previousGroup: string | undefined;

  for (const command of commandMenuItems(commandRegistry, section)) {
    const group = command.menu?.group;
    if (items.length > 0 && group !== previousGroup) items.push({ separator: true });
    items.push(commandMenuItem(commandRegistry, command));
    previousGroup = group;
  }

  return items;
}

function commandMenuItem(commandRegistry: CommandRegistry, command: CommandContribution): RegisteredMenuItem {
  return {
    commandId: command.id,
    label: command.menu?.label ?? command.label,
    shortcut: formatShortcut(command.defaultShortcut),
    disabled: command.isEnabled?.() === false,
    action: () => dispatchCommand(commandRegistry, command.id),
  };
}

function withLeadingSeparator(items: AppMenuItem[]): AppMenuItem[] {
  return items.length > 0 ? [{ separator: true }, ...items] : [];
}

function runDocumentCommand(command: string, target: HTMLElement | null): void {
  target?.focus();
  document.execCommand(command);
}

async function runPasteCommand(target: HTMLElement | null): Promise<void> {
  target?.focus();
  if (document.execCommand('paste')) return;

  if ((target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) && navigator.clipboard?.readText) {
    const text = await navigator.clipboard.readText();
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.setRangeText(text, start, end, 'end');
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

async function runWindowAction(action: 'minimize' | 'toggleMaximize' | 'close'): Promise<void> {
  if (!currentPlatformCapabilities().has('window.chrome')) return;
  await Backend.runtime.runWindowAction(action);
}
