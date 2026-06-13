import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { CommandRegistry } from '../../app/commands';
import { useUIStore } from '../../store/ui';
import type { ViewMode } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { MenuSurface } from '../ui/surface/MenuSurface';
import { buildAppMenus, type AppMenuGroup, type AppMenuHandlers, type AppMenuId } from '../shell/appMenus';

interface AndroidSidebarMenuProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  handlers: AppMenuHandlers;
  commandRegistry: CommandRegistry;
  effectiveViewMode: ViewMode;
  availableViewModes: readonly ViewMode[];
}

export function AndroidSidebarMenu({
  textareaRef,
  handlers,
  commandRegistry,
  effectiveViewMode,
  availableViewModes,
}: AndroidSidebarMenuProps) {
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
        getDocumentCommandTarget: () => lastFocusedRef.current ?? textareaRef.current,
        includeWindowMenu: false,
      }).filter((menu) => menu.id !== 'window'),
    [
      availableViewModes,
      commandRegistry,
      effectiveViewMode,
      handlers,
      setViewMode,
      syncScroll,
      textareaRef,
      toggleSidebar,
      toggleSyncScroll,
      viewMode,
    ],
  );

  useEffect(() => {
    if (!openMenu) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpenMenu(null);
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
    <nav className="android-sidebar-menu" ref={rootRef} aria-label="Application menu">
      {menus.map((menu) => (
        <AndroidSidebarMenuGroup
          key={menu.id}
          menu={menu}
          open={openMenu === menu.id}
          onRememberFocus={rememberFocus}
          onToggle={() => setOpenMenu((current) => (current === menu.id ? null : menu.id))}
          onClose={() => setOpenMenu(null)}
        />
      ))}
    </nav>
  );
}

function AndroidSidebarMenuGroup({
  menu,
  open,
  onRememberFocus,
  onToggle,
  onClose,
}: {
  menu: AppMenuGroup;
  open: boolean;
  onRememberFocus: () => void;
  onToggle: () => void;
  onClose: () => void;
}) {
  const iconName = androidSidebarMenuIconName(menu.id);

  if (!iconName) return null;

  return (
    <div className="android-sidebar-menu-group">
      <button
        className={`android-sidebar-menu-button ${open ? 'active' : ''}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={menu.label}
        onPointerDown={onRememberFocus}
        onClick={onToggle}
      >
        <Icon name={iconName} />
        <span className="android-sidebar-menu-label">{menu.label}</span>
      </button>
      {open ? (
        <MenuSurface className="android-sidebar-menu-panel" role="menu">
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
                  onClose();
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
  );
}

function androidSidebarMenuIconName(menuId: AppMenuId) {
  switch (menuId) {
    case 'file':
      return 'file';
    case 'edit':
      return 'edit';
    case 'view':
      return 'eye';
    case 'help':
      return 'info';
    case 'window':
      return null;
  }
}
