import { useEffect, useRef } from 'react';
import { closeFileWithProtection } from '../../hooks/useCloseProtection';
import { isDirty, useWorkspaceStore } from '../../store/workspace';
import type { OpenFile } from '../../types/workspace';

export function TabStrip() {
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const activeFileId = useWorkspaceStore((state) => state.activeFileId);
  const setActiveFile = useWorkspaceStore((state) => state.setActiveFile);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeFileId]);

  if (openFiles.length === 0) return null;

  return (
    <div className="document-tab-strip" role="tablist" aria-label="열린 문서">
      {openFiles.map((file, index) => {
        const active = file.id === activeFileId;
        return (
          <div className="document-tab" data-active={active} key={file.id}>
            <button
              aria-selected={active}
              className="document-tab-select"
              ref={active ? activeTabRef : undefined}
              role="tab"
              title={`${file.name}${index < 9 ? ` (⌘${index + 1})` : ''}`}
              type="button"
              onAuxClick={(event) => {
                if (event.button === 1) void requestClose(file);
              }}
              onClick={() => setActiveFile(file.id)}
            >
              <span className="document-tab-name">{file.name}</span>
              {isDirty(file) ? <span aria-label="저장되지 않은 변경사항" className="document-tab-dirty" /> : null}
            </button>
            <button
              aria-label={`${file.name} 닫기`}
              className="document-tab-close"
              title="탭 닫기"
              type="button"
              onClick={() => void requestClose(file)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

async function requestClose(file: OpenFile): Promise<void> {
  try {
    await closeFileWithProtection(file.id);
  } catch (error) {
    console.error('탭 닫기 실패:', error);
  }
}
