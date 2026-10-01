import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
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
  const { t } = useI18n();
  const [openMenu, setOpenMenu] = useState<AppMenuId | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const viewMode = useUIStore((state) => state.viewMode);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);

  /*
   * Built on every render rather than memoised. Each item's enabled state is
   * read at build time, so a cached list went stale: Save stayed greyed out
   * after a document opened, because nothing in the dependency list had
   * changed. Opening a menu re-renders this component, so the flags shown are
   * always the current ones.
   */
  const menus: AppMenuGroup[] = buildAppMenus({
    commandRegistry,
    viewMode,
    effectiveViewMode,
    syncScroll,
    toggleSyncScroll,
    getDocumentCommandTarget: () => lastFocusedRef.current ?? textareaRef.current,
    includeWindowMenu: false,
  }).filter((menu) => menu.id !== 'window' && menu.id !== 'help' && menu.id !== 'view');

  useEffect(() => {
    if (!openMenu) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (rootRef.current?.contains(target) || panelRef.current?.contains(target))) return;
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
          panelRef={panelRef}
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
  panelRef,
  onToggle,
  onClose,
}: {
  readonly menu: AppMenuGroup;
  readonly open: boolean;
  readonly onRememberFocus: () => void;
  readonly panelRef: RefObject<HTMLDivElement>;
  readonly onToggle: () => void;
  readonly onClose: () => void;
}) {
  const iconName = sidebarMenuIconName(menu.id);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  if (!iconName) return null;

  return (
    <div className="sidebar-menu-group">
      <button
        ref={buttonRef}
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
      {open ? createPortal(
        <MenuSurface
          className="sidebar-menu-panel sidebar-menu-panel-portal"
          ref={panelRef}
          role="menu"
          style={portalMenuStyle(buttonRef.current)}
        >
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
        </MenuSurface>,
        document.body,
      ) : null}
    </div>
  );
}

/*
 * The panel is always portalled to the body. Rendering it inside the sidebar
 * meant `overflow: hidden` clipped it and the sidebar's width squeezed the
 * labels, so "Save As..." and "Local version history..." showed as ellipses.
 * Free of that box it can size to its own content.
 */
function portalMenuStyle(anchor: HTMLButtonElement | null): CSSProperties {
  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight;
  const maxWidth = Math.max(180, Math.min(320, viewportWidth - 16));
  const rect = anchor?.getBoundingClientRect();
  const top = (rect?.bottom ?? 48) + 6;
  return {
    position: 'fixed',
    top,
    left: Math.max(8, Math.min(rect?.left ?? 8, viewportWidth - maxWidth - 8)),
    right: 'auto',
    minWidth: 180,
    maxWidth,
    maxHeight: Math.max(160, viewportHeight - top - 12),
  };
}

function sidebarMenuIconName(menuId: AppMenuId) {
  switch (menuId) {
    case 'file':
      return 'file';
    case 'edit':
      return 'edit';
    case 'view':
      return null;
    case 'help':
      return 'info';
    case 'window':
      return null;
  }
}
