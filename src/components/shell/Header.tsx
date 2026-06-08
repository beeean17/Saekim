import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { commandMenuItems, dispatchCommand, formatShortcut, type CommandRegistry } from '../../app/commands';
import { Backend } from '../../platform/common/backend';
import { useUIStore } from '../../store/ui';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';
import { SegmentedControl } from '../ui/primitives/SegmentedControl';
import { MenuSurface } from '../ui/surface/MenuSurface';

export interface AppMenuHandlers {
  onNewFile: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onClose: () => void;
}

type AppMenuId = 'file' | 'edit' | 'view' | 'window' | 'help';

interface AppMenuItem {
  label?: string;
  shortcut?: string;
  checked?: boolean;
  separator?: boolean;
  action?: () => void;
}

interface AppMenuGroup {
  id: AppMenuId;
  label: string;
  items: AppMenuItem[];
}

export function Header({ menuHandlers, commandRegistry }: { menuHandlers: AppMenuHandlers; commandRegistry: CommandRegistry }) {
  const toggleSettings = useUIStore((state) => state.toggleSettings);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const dirty = isDirty(activeFile);
  const parts = activeFile?.path.split(/[\\/]/) ?? [];
  const isWindows = useIsWindowsRuntime();

  return (
    <header className={`titlebar ${isWindows ? 'windows-titlebar' : ''}`} onMouseDown={startTitlebarDrag}>
      <div className="titlebar-drag" data-tauri-drag-region />
      {isWindows ? <AppMenu handlers={menuHandlers} commandRegistry={commandRegistry} /> : null}
      <div className="breadcrumb titlebar-path" data-tauri-drag-region title={activeFile?.path}>
        {activeFile
          ? parts.map((part, index) => (
              <span className="crumb-wrap" key={`${part}-${index}`}>
                <span className={`crumb ${index === parts.length - 1 ? 'current' : ''}`}>{part}</span>
                {index < parts.length - 1 ? <span className="sep">/</span> : null}
              </span>
            ))
          : null}
        {dirty ? <span className="dot" title="수정 중" /> : null}
      </div>

      <div className="titlebar-right">
        <ViewToggle />
        <IconButton className="header-btn" label="설정" onClick={toggleSettings}>
          <Icon name="settings" />
        </IconButton>
      </div>
    </header>
  );
}

function startTitlebarDrag(event: MouseEvent<HTMLElement>): void {
  if (event.button !== 0 || !('__TAURI_INTERNALS__' in window)) return;

  const target = event.target as HTMLElement | null;
  if (target?.closest('button, input, textarea, select, a, [role="button"]')) return;

  event.preventDefault();
  void invoke('start_window_drag').catch((error) => {
    console.warn('Failed to start titlebar drag:', error);
  });
}

function ViewToggle() {
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);

  return (
    <SegmentedControl
      ariaLabel="보기 모드"
      className="view-toggle header-view-toggle"
      size="sm"
      value={viewMode}
      options={[
        { value: 'edit', label: '편집', icon: <Icon name="edit" />, title: '편집기만' },
        { value: 'split', label: '분할', icon: <Icon name="split" />, title: '분할 보기' },
        { value: 'preview', label: '보기', icon: <Icon name="eye" />, title: '미리보기만' },
      ]}
      onChange={setViewMode}
    />
  );
}

function AppMenu({ handlers, commandRegistry }: { handlers: AppMenuHandlers; commandRegistry: CommandRegistry }) {
  const [openMenu, setOpenMenu] = useState<AppMenuId | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);
  const fileCommands = commandMenuItems(commandRegistry, 'file');
  const editCommands = commandMenuItems(commandRegistry, 'edit');

  const menus = useMemo<AppMenuGroup[]>(
    () => [
      {
        id: 'file',
        label: 'File',
        items: [
          { label: 'New File', shortcut: 'Ctrl+N', action: handlers.onNewFile },
          { label: 'Open File...', shortcut: 'Ctrl+O', action: handlers.onOpen },
          { label: 'Open Folder...', shortcut: 'Ctrl+Shift+O', action: handlers.onOpenFolder },
          { separator: true },
          { label: 'Save', shortcut: 'Ctrl+S', action: handlers.onSave },
          { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: handlers.onSaveAs },
          ...fileCommands.map((command) => ({
            label: command.menu?.label,
            shortcut: formatShortcut(command.defaultShortcut),
            action: () => dispatchCommand(commandRegistry, command.id),
          })),
          { separator: true },
          { label: 'Close File', shortcut: 'Ctrl+W', action: handlers.onClose },
        ],
      },
      {
        id: 'edit',
        label: 'Edit',
        items: [
          { label: 'Undo', shortcut: 'Ctrl+Z', action: () => runDocumentCommand('undo', lastFocusedRef.current) },
          { label: 'Redo', shortcut: 'Ctrl+Y', action: () => runDocumentCommand('redo', lastFocusedRef.current) },
          { separator: true },
          { label: 'Cut', shortcut: 'Ctrl+X', action: () => runDocumentCommand('cut', lastFocusedRef.current) },
          { label: 'Copy', shortcut: 'Ctrl+C', action: () => runDocumentCommand('copy', lastFocusedRef.current) },
          { label: 'Paste', shortcut: 'Ctrl+V', action: () => void runPasteCommand(lastFocusedRef.current) },
          { separator: true },
          ...editCommands.map((command) => ({
            label: command.menu?.label,
            shortcut: formatShortcut(command.defaultShortcut),
            action: () => dispatchCommand(commandRegistry, command.id),
          })),
          { label: 'Select All', shortcut: 'Ctrl+A', action: () => runDocumentCommand('selectAll', lastFocusedRef.current) },
        ],
      },
      {
        id: 'view',
        label: 'View',
        items: [
          { label: 'Editor Only', checked: viewMode === 'edit', action: () => setViewMode('edit') },
          { label: 'Split View', checked: viewMode === 'split', action: () => setViewMode('split') },
          { label: 'Preview Only', checked: viewMode === 'preview', action: () => setViewMode('preview') },
          { separator: true },
          { label: 'Toggle Sidebar', action: toggleSidebar },
          { label: 'Sync Scroll', checked: syncScroll, action: toggleSyncScroll },
        ],
      },
      {
        id: 'window',
        label: 'Window',
        items: [
          { label: 'Minimize', action: () => void runWindowAction('minimize') },
          { label: 'Maximize / Restore', action: () => void runWindowAction('toggleMaximize') },
          { separator: true },
          { label: 'Close Window', action: () => void runWindowAction('close') },
        ],
      },
      {
        id: 'help',
        label: 'Help',
        items: [{ label: 'About Saekim', action: () => window.alert('Saekim 3.0.1') }],
      },
    ],
    [editCommands, fileCommands, handlers, setViewMode, syncScroll, toggleSidebar, toggleSyncScroll, viewMode],
  );

  useEffect(() => {
    if (!openMenu) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    window.addEventListener('pointerdown', closeOnPointerDown);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnPointerDown);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenu]);

  const rememberFocus = () => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && !rootRef.current?.contains(activeElement)) {
      lastFocusedRef.current = activeElement;
    }
  };

  return (
    <nav className="app-menu" ref={rootRef} aria-label="Application menu">
      {menus.map((menu) => (
        <div className="app-menu-group" key={menu.id}>
          <button
            className={`app-menu-button ${openMenu === menu.id ? 'active' : ''}`}
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === menu.id}
            onMouseDown={rememberFocus}
            onClick={() => setOpenMenu((current) => (current === menu.id ? null : menu.id))}
          >
            {menu.label}
          </button>
          {openMenu === menu.id ? (
            <MenuSurface className="app-menu-panel" role="menu">
              {menu.items.map((item, index) =>
                item.separator ? (
                  <div className="app-menu-separator" key={`${menu.id}-separator-${index}`} role="separator" />
                ) : (
                  <button
                    className="app-menu-item"
                    key={`${menu.id}-${item.label}`}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      item.action?.();
                    }}
                  >
                    <span className="app-menu-check">{item.checked ? '✓' : ''}</span>
                    <span className="app-menu-label">{item.label}</span>
                    {item.shortcut ? <span className="app-menu-shortcut">{item.shortcut}</span> : null}
                  </button>
                ),
              )}
            </MenuSurface>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

function useIsWindowsRuntime(): boolean {
  const [isWindows, setIsWindows] = useState(false);

  useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    setIsWindows(platform.startsWith('win') || userAgent.includes('windows'));
  }, []);

  return isWindows;
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
  if (!Backend.runtime.isTauriRuntime()) return;
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const window = getCurrentWebviewWindow();
  await window[action]();
}
