import type { MouseEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';

export function Header() {
  const toggleSettings = useUIStore((state) => state.toggleSettings);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const dirty = isDirty(activeFile);
  const parts = activeFile?.path.split('/') ?? [];

  return (
    <header className="titlebar" onMouseDown={startTitlebarDrag}>
      <div className="titlebar-drag" data-tauri-drag-region />
      <div className="breadcrumb titlebar-path" data-tauri-drag-region title={activeFile?.path}>
        {activeFile
          ? parts.map((part, index) => (
              <span className="crumb-wrap" key={`${part}-${index}`}>
                <span className={`crumb ${index === parts.length - 1 ? 'current' : ''}`}>{part}</span>
                {index < parts.length - 1 ? <span className="sep">/</span> : null}
              </span>
            ))
          : null}
        {dirty ? <span className="dot" title="수정 중" /> : null}
      </div>

      <div className="titlebar-right">
        <ViewToggle />
        <IconButton className="header-btn" label="설정" onClick={toggleSettings}>
          <Icon name="settings" />
        </IconButton>
      </div>
    </header>
  );
}

function startTitlebarDrag(event: MouseEvent<HTMLElement>): void {
  if (event.button !== 0 || !('__TAURI_INTERNALS__' in window)) return;

  const target = event.target as HTMLElement | null;
  if (target?.closest('button, input, textarea, select, a, [role="button"]')) return;

  event.preventDefault();
  void invoke('start_window_drag').catch((error) => {
    console.warn('Failed to start titlebar drag:', error);
  });
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
