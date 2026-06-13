import { useEffect, useMemo, useRef, useState } from 'react';
import type { CommandRegistry } from '../../app/commands';
import { useUIStore } from '../../store/ui';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { ViewMode } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';
import { MenuSurface } from '../ui/surface/MenuSurface';
import { buildAppMenus, type AppMenuGroup, type AppMenuHandlers, type AppMenuId } from './appMenus';
import { handleTitlebarMouseDown } from './titlebarWindowControls';

export type { AppMenuHandlers } from './appMenus';

interface HeaderProps {
  menuHandlers: AppMenuHandlers;
  commandRegistry: CommandRegistry;
  effectiveViewMode: ViewMode;
  availableViewModes: readonly ViewMode[];
}

export function Header({ menuHandlers, commandRegistry, effectiveViewMode, availableViewModes }: HeaderProps) {
  const toggleSettings = useUIStore((state) => state.toggleSettings);
  const settingsOpen = useUIStore((state) => state.settingsOpen);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const dirty = isDirty(activeFile);
  const isWindows = useIsWindowsRuntime();
  const showHeaderMenu = isWindows;

  return (
    <header
      className={`titlebar ${isWindows ? 'windows-titlebar' : ''} ${showHeaderMenu ? 'menu-titlebar' : ''}`}
      onMouseDown={handleTitlebarMouseDown}
    >
      <div className="titlebar-drag" data-tauri-drag-region />
      {showHeaderMenu ? (
        <AppMenu
          handlers={menuHandlers}
          commandRegistry={commandRegistry}
          effectiveViewMode={effectiveViewMode}
          availableViewModes={availableViewModes}
        />
      ) : null}
      <div className="breadcrumb titlebar-path" data-tauri-drag-region title={activeFile?.name}>
        {activeFile ? <span className="crumb current">{activeFile.name}</span> : null}
        {dirty ? <span className="dot" title="수정 중" /> : null}
      </div>

      <div className="titlebar-right">
        <IconButton
          aria-expanded={settingsOpen}
          aria-pressed={settingsOpen}
          className="header-btn"
          data-settings-trigger="true"
          label="설정"
          onClick={toggleSettings}
        >
          <Icon name="settings" />
        </IconButton>
      </div>
    </header>
  );
}

function AppMenu({
  handlers,
  commandRegistry,
  effectiveViewMode,
  availableViewModes,
}: {
  handlers: AppMenuHandlers;
  commandRegistry: CommandRegistry;
  effectiveViewMode: ViewMode;
  availableViewModes: readonly ViewMode[];
}) {
  const [openMenu, setOpenMenu] = useState<AppMenuId | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);

  const menus = useMemo<AppMenuGroup[]>(
    () =>
      buildAppMenus({
        handlers,
        commandRegistry,
        viewMode,
        effectiveViewMode,
        availableViewModes,
        setViewMode,
        toggleSidebar,
        syncScroll,
        toggleSyncScroll,
        getDocumentCommandTarget: () => lastFocusedRef.current,
      }),
    [
      availableViewModes,
      commandRegistry,
      effectiveViewMode,
      handlers,
      setViewMode,
      syncScroll,
      toggleSidebar,
      toggleSyncScroll,
      viewMode,
    ],
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
