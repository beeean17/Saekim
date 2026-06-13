import { commandMenuItems, dispatchCommand, formatShortcut, type CommandRegistry } from '../../app/commands';
import { Backend } from '../../platform/common/backend';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';
import type { ViewMode } from '../../types/workspace';

export interface AppMenuHandlers {
  onNewFile: () => void;
  onNewWindow: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}

export type AppMenuId = 'file' | 'edit' | 'view' | 'window' | 'help';

export interface AppMenuItem {
  label?: string;
  shortcut?: string;
  checked?: boolean;
  separator?: boolean;
  action?: () => void;
}

export interface AppMenuGroup {
  id: AppMenuId;
  label: string;
  items: AppMenuItem[];
}

export interface BuildAppMenusOptions {
  handlers: AppMenuHandlers;
  commandRegistry: CommandRegistry;
  viewMode: ViewMode;
  effectiveViewMode: ViewMode;
  availableViewModes: readonly ViewMode[];
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  syncScroll: boolean;
  toggleSyncScroll: () => void;
  getDocumentCommandTarget: () => HTMLElement | null;
  includeWindowMenu?: boolean;
}

const viewModeLabels: Record<ViewMode, string> = {
  edit: 'Editor Only',
  split: 'Split View',
  preview: 'Preview Only',
};

export function buildAppMenus({
  handlers,
  commandRegistry,
  viewMode,
  effectiveViewMode,
  availableViewModes,
  setViewMode,
  toggleSidebar,
  syncScroll,
  toggleSyncScroll,
  getDocumentCommandTarget,
  includeWindowMenu = currentPlatformCapabilities().has('window.chrome'),
}: BuildAppMenusOptions): AppMenuGroup[] {
  const capabilities = currentPlatformCapabilities();
  const fileCommands = commandMenuItems(commandRegistry, 'file').filter(
    (command) => command.id !== 'pdf.exportCurrent' || capabilities.has('pdf.save'),
  );
  const editCommands = commandMenuItems(commandRegistry, 'edit');
  const viewItems = availableViewModes.map((mode) => ({
    label: viewModeLabels[mode],
    checked: effectiveViewMode === mode,
    action: () => setViewMode(mode),
  }));
  const menus: AppMenuGroup[] = [
    {
      id: 'file',
      label: 'File',
      items: [
        { label: 'New File', shortcut: 'Ctrl+N', action: handlers.onNewFile },
        ...(includeWindowMenu
          ? [{ label: 'New Window', shortcut: 'Ctrl+Shift+N', action: handlers.onNewWindow }]
          : []),
        { label: 'Open File...', shortcut: 'Ctrl+O', action: handlers.onOpen },
        ...(capabilities.has('folder.open')
          ? [{ label: 'Open Folder...', shortcut: 'Ctrl+Shift+O', action: handlers.onOpenFolder }]
          : []),
        { separator: true },
        { label: 'Save', shortcut: 'Ctrl+S', action: handlers.onSave },
        { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: handlers.onSaveAs },
        ...fileCommands.map((command) => ({
          label: command.menu?.label,
          shortcut: formatShortcut(command.defaultShortcut),
          action: () => dispatchCommand(commandRegistry, command.id),
        })),
      ],
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
        ...editCommands.map((command) => ({
          label: command.menu?.label,
          shortcut: formatShortcut(command.defaultShortcut),
          action: () => dispatchCommand(commandRegistry, command.id),
        })),
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => runDocumentCommand('selectAll', getDocumentCommandTarget()) },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        ...viewItems,
        { separator: true },
        { label: 'Toggle Sidebar', action: toggleSidebar },
        ...(viewMode === 'split' && effectiveViewMode === 'split'
          ? [{ label: 'Sync Scroll', checked: syncScroll, action: toggleSyncScroll }]
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
        { separator: true },
        { label: 'Close Window', action: () => void runWindowAction('close') },
      ],
    });
  }

  menus.push({
    id: 'help',
    label: 'Help',
    items: [{ label: 'About Saekim', action: () => window.alert('Saekim 3.1.0') }],
  });

  return menus;
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
