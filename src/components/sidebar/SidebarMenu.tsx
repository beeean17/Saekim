import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { CommandRegistry } from '../../app/commands';
import { useUIStore } from '../../store/ui';
import type { ViewMode } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { MenuSurface } from '../ui/surface/MenuSurface';
import { buildAppMenus, type AppMenuGroup, type AppMenuId } from '../shell/appMenus';
import { useI18n } from '../../i18n/useI18n';

interface SidebarMenuProps {
  readonly className?: string;
  readonly textareaRef: RefObject<HTMLTextAreaElement>;
  readonly commandRegistry: CommandRegistry;
  readonly effectiveViewMode: ViewMode;
}

export function SidebarMenu({
  className,
  textareaRef,
  commandRegistry,
  effectiveViewMode,
}: SidebarMenuProps) {
  const { language, t } = useI18n();
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
        getDocumentCommandTarget: () => lastFocusedRef.current ?? textareaRef.current,
        includeWindowMenu: false,
      }).filter((menu) => menu.id !== 'window' && menu.id !== 'help'),
    [
      commandRegistry,
      effectiveViewMode,
      language,
      syncScroll,
      textareaRef,
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
  const rootClassName = className ? `sidebar-menu ${className}` : 'sidebar-menu';

  return (
    <nav className={rootClassName} ref={rootRef} aria-label={t('menu.application')}>
      {menus.map((menu) => (
        <SidebarMenuGroup
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

function SidebarMenuGroup({
  menu,
  open,
  onRememberFocus,
  onToggle,
  onClose,
}: {
  readonly menu: AppMenuGroup;
  readonly open: boolean;
  readonly onRememberFocus: () => void;
  readonly onToggle: () => void;
  readonly onClose: () => void;
}) {
  const iconName = sidebarMenuIconName(menu.id);

  if (!iconName) return null;

  return (
    <div className="sidebar-menu-group">
      <button
        className={`sidebar-menu-button ${open ? 'active' : ''}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={menu.label}
        onPointerDown={onRememberFocus}
        onClick={onToggle}
      >
        <Icon name={iconName} />
        <span className="sidebar-menu-label">{menu.label}</span>
      </button>
      {open ? (
        <MenuSurface className="sidebar-menu-panel" role="menu">
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

function sidebarMenuIconName(menuId: AppMenuId) {
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
