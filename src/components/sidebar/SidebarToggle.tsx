import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';

export function SidebarToggle() {
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const sidebarToggleLabel = sidebarMode === 'expanded' ? '탐색기 접기' : '탐색기 펼치기';

  return (
    <button
      aria-label={sidebarToggleLabel}
      className="brand-mark sidebar-toggle"
      title={sidebarToggleLabel}
      type="button"
      onClick={toggleSidebar}
    >
      <Icon name={sidebarMode === 'expanded' ? 'folderOpen' : 'folder'} />
    </button>
  );
}
