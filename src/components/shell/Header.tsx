import { useEffect, useMemo, useRef, useState } from 'react';
import type { CommandRegistry } from '../../app/commands';
import { Platform } from '../../platform/common/platform';
import { useUIStore } from '../../store/ui';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { ViewMode } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';
import { SegmentedControl } from '../ui/primitives/SegmentedControl';
import { MenuSurface } from '../ui/surface/MenuSurface';
import { buildAppMenus, type AppMenuGroup, type AppMenuId } from './appMenus';
import { handleTitlebarMouseDown } from './titlebarWindowControls';

interface HeaderProps {
  commandRegistry: CommandRegistry;
  effectiveViewMode: ViewMode;
  availableViewModes: readonly ViewMode[];
}

export function Header({ commandRegistry, effectiveViewMode, availableViewModes }: HeaderProps) {
  const toggleSettings = useUIStore((state) => state.toggleSettings);
  const settingsOpen = useUIStore((state) => state.settingsOpen);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const dirty = isDirty(activeFile);
  const windowChrome = Platform.windowChrome;
  const titlebarClassName = windowChrome.titlebarClassName
    ? `titlebar ${windowChrome.titlebarClassName}`
    : 'titlebar';
  const showHeaderMenu = windowChrome.showsApplicationMenu;

  return (
    <header className={titlebarClassName} onMouseDown={handleTitlebarMouseDown}>
      <div className="titlebar-drag" data-tauri-drag-region />
      {showHeaderMenu ? (
        <AppMenu
          commandRegistry={commandRegistry}
          effectiveViewMode={effectiveViewMode}
        />
      ) : null}
      <div className="breadcrumb titlebar-path" data-tauri-drag-region title={activeFile?.name}>
        {activeFile ? <span className="crumb current">{activeFile.name}</span> : null}
        {dirty ? <span className="dot" title="수정 중" /> : null}
      </div>

      <div className="titlebar-right">
        <ViewToggle availableViewModes={availableViewModes} effectiveViewMode={effectiveViewMode} />
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

function ViewToggle({
  availableViewModes,
  effectiveViewMode,
}: {
  availableViewModes: readonly ViewMode[];
  effectiveViewMode: ViewMode;
}) {
  const setViewMode = useUIStore((state) => state.setViewMode);
  const options = [
    { value: 'edit' as const, label: '편집', icon: <Icon name="edit" />, title: '편집기만' },
    { value: 'split' as const, label: '분할', icon: <Icon name="split" />, title: '분할 보기' },
    { value: 'preview' as const, label: '보기', icon: <Icon name="eye" />, title: '미리보기만' },
  ]
    .filter((option) => availableViewModes.includes(option.value))
    .map((option) => ({
      ...option,
      label: <span className="view-toggle-label">{option.label}</span>,
    }));

  return (
    <SegmentedControl
      ariaLabel="보기 모드"
      className="view-toggle header-view-toggle"
      size="sm"
      value={effectiveViewMode}
      options={options}
      onChange={setViewMode}
    />
  );
}

function AppMenu({
  commandRegistry,
  effectiveViewMode,
}: {
  commandRegistry: CommandRegistry;
  effectiveViewMode: ViewMode;
}) {
  const [openMenu, setOpenMenu] = useState<AppMenuId | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const viewMode = useUIStore((state) => state.viewMode);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);

  const menus = useMemo<AppMenuGroup[]>(
    () =>
      buildAppMenus({
        commandRegistry,
        viewMode,
        effectiveViewMode,
        syncScroll,
        toggleSyncScroll,
        getDocumentCommandTarget: () => lastFocusedRef.current,
      }),
    [
      commandRegistry,
      effectiveViewMode,
      syncScroll,
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
                    disabled={item.disabled}
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
