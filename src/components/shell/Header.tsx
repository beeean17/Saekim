import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';

export function Header() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const toggleSettings = useUIStore((state) => state.toggleSettings);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const dirty = isDirty(activeFile);
  const parts = (activeFile?.path || '~/Documents/notes/readme.md').split('/');

  return (
    <header className="header">
      <div className="brand">
        <button className="brand-mark" title="탐색기 접기/펼치기" type="button" onClick={toggleSidebar}>
          <Icon name="sidebar" />
        </button>
        <div className="brand-name">Saekim</div>
      </div>

      <div className="breadcrumb" title={activeFile?.path}>
        {parts.map((part, index) => (
          <span className="crumb-wrap" key={`${part}-${index}`}>
            <span className={`crumb ${index === parts.length - 1 ? 'current' : ''}`}>{part}</span>
            {index < parts.length - 1 ? <span className="sep">/</span> : null}
          </span>
        ))}
        {dirty ? <span className="dot" title="수정 중" /> : null}
      </div>

      <div className="header-right">
        <ViewToggle />
        <IconButton className="header-btn" label="설정" onClick={toggleSettings}>
          <Icon name="settings" />
        </IconButton>
      </div>
    </header>
  );
}

function ViewToggle() {
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);

  return (
    <div className="view-toggle header-view-toggle" aria-label="보기 모드">
      <button className={viewMode === 'edit' ? 'active' : ''} title="편집기만" type="button" onClick={() => setViewMode('edit')}>
        <Icon name="edit" />
        편집
      </button>
      <button className={viewMode === 'split' ? 'active' : ''} title="분할 보기" type="button" onClick={() => setViewMode('split')}>
        <Icon name="split" />
        분할
      </button>
      <button className={viewMode === 'preview' ? 'active' : ''} title="미리보기만" type="button" onClick={() => setViewMode('preview')}>
        <Icon name="eye" />
        보기
      </button>
    </div>
  );
}
