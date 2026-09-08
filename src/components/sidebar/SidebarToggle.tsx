import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';

export function SidebarToggle({ compact }: { readonly compact: boolean }) {
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const compactSidebarOpen = useUIStore((state) => state.compactSidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const toggleCompactSidebar = useUIStore((state) => state.toggleCompactSidebar);
  const expanded = compact ? compactSidebarOpen : sidebarMode === 'expanded';
  const sidebarToggleLabel = expanded ? '탐색기 닫기' : '탐색기 열기';

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
