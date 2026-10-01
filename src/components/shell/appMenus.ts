import { commandMenuItems, dispatchCommand, formatShortcut, type CommandRegistry } from '../../app/commands';
import { Backend } from '../../platform/common/backend';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';
import type { CommandContribution } from '../../app/feature';
import type { ViewMode } from '../../types/workspace';
import { openProjectWebsite, showAboutDialog, showKeyboardShortcuts } from '../../app/help';
import { translate } from '../../i18n/messages';
import { useSettingsStore } from '../../store/settings';

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
  const language = useSettingsStore.getState().language;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const fileItems = registeredMenuItems(commandRegistry, 'file');
  const allEditItems = registeredMenuItems(commandRegistry, 'edit');
  const historyIds = ['edit.undo', 'edit.redo'];
  const historyItems = allEditItems.filter((item) => item.commandId && historyIds.includes(item.commandId));
  const editItems = allEditItems.filter((item) => !item.commandId || !historyIds.includes(item.commandId));
  const viewItems = registeredMenuItems(commandRegistry, 'view').map((item) => ({
    ...item,
    checked: item.commandId === `view.${effectiveViewMode}` ? true : item.checked,
  }));
  const menus: AppMenuGroup[] = [
    {
      id: 'file',
      label: t('menu.file'),
      items: includeWindowMenu ? fileItems : fileItems.filter((item) => item.commandId !== 'window.new'),
    },
    {
      id: 'edit',
      label: t('menu.edit'),
      /*
       * Shortcut hints go through formatShortcut so they read as Cmd glyphs on
       * macOS and Ctrl elsewhere, instead of the Windows spelling everywhere.
       * Undo/redo are registered commands now, so the label, the enabled state
       * and the key all come from one place.
       */
      items: compactSeparators([
        ...historyItems,
        { separator: true },
        { label: t('menu.cut'), shortcut: formatShortcut('mod+x'), action: () => runDocumentCommand('cut', getDocumentCommandTarget()) },
        { label: t('menu.copy'), shortcut: formatShortcut('mod+c'), action: () => runDocumentCommand('copy', getDocumentCommandTarget()) },
        { label: t('menu.paste'), shortcut: formatShortcut('mod+v'), action: () => void runPasteCommand(getDocumentCommandTarget()) },
        { separator: true },
        ...editItems,
        { label: t('menu.selectAll'), shortcut: formatShortcut('mod+a'), action: () => runDocumentCommand('selectAll', getDocumentCommandTarget()) },
      ]),
    },
    {
      id: 'view',
      label: t('menu.view'),
      items: [
        ...viewItems,
        ...(viewMode === 'split' && effectiveViewMode === 'split'
          ? [{ separator: true }, { label: t('menu.syncScroll'), checked: syncScroll, action: toggleSyncScroll }]
          : []),
      ],
    },
  ];

  if (includeWindowMenu) {
    menus.push({
      id: 'window',
      label: t('menu.window'),
      items: [
        { label: t('menu.minimize'), action: () => void runWindowAction('minimize') },
        { label: t('menu.maximizeRestore'), action: () => void runWindowAction('toggleMaximize') },
        ...withLeadingSeparator(registeredMenuItems(commandRegistry, 'window')),
      ],
    });
  }

  menus.push({
    id: 'help',
    label: t('menu.help'),
    items: [
      { label: t('menu.github'), action: openProjectWebsite },
      { label: t('menu.shortcuts'), action: showKeyboardShortcuts },
      { separator: true },
      { label: t('menu.about'), action: showAboutDialog },
    ],
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

/** Drops leading, trailing and doubled separators left behind by regrouping. */
function compactSeparators(items: AppMenuItem[]): AppMenuItem[] {
  const compacted: AppMenuItem[] = [];
  for (const item of items) {
    if (!item.separator) {
      compacted.push(item);
      continue;
    }
    if (compacted.length === 0 || compacted[compacted.length - 1].separator) continue;
    compacted.push(item);
  }
  while (compacted.length > 0 && compacted[compacted.length - 1].separator) compacted.pop();
  return compacted;
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
