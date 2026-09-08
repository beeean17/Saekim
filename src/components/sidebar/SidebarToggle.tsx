import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';
import { useI18n } from '../../i18n/useI18n';

export function SidebarToggle({ compact }: { readonly compact: boolean }) {
  const { t } = useI18n();
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const compactSidebarOpen = useUIStore((state) => state.compactSidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const toggleCompactSidebar = useUIStore((state) => state.toggleCompactSidebar);
  const expanded = compact ? compactSidebarOpen : sidebarMode === 'expanded';
  const sidebarToggleLabel = expanded ? t('sidebar.closeExplorer') : t('sidebar.openExplorer');

  return (
    <button
      aria-label={sidebarToggleLabel}
      aria-controls="saekim-sidebar"
      aria-expanded={expanded}
      className="brand-mark sidebar-toggle"
      title={sidebarToggleLabel}
      type="button"
      onClick={compact ? toggleCompactSidebar : toggleSidebar}
    >
      <Icon name={expanded ? 'folderOpen' : 'folder'} />
    </button>
  );
}
