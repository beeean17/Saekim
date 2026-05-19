import { useSettingsStore } from '../../store/settings';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { useUIStore } from '../../store/ui';
import type { ThemeName } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';

const themes: ThemeName[] = ['default', 'dark', 'nord'];

export function Header() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
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
        <IconButton className="header-btn" label="찾기">
          <Icon name="search" />
        </IconButton>
        <IconButton className="header-btn" label="설정">
          <Icon name="settings" />
        </IconButton>
        <div className="theme-switcher">
          {themes.map((candidate) => (
            <button
              className={`theme-chip ${theme === candidate ? 'active' : ''}`}
              data-set={candidate}
              key={candidate}
              title={candidate}
              aria-label={`${candidate} 테마`}
              type="button"
              onClick={() => setTheme(candidate)}
            />
          ))}
        </div>
      </div>
    </header>
  );
}
