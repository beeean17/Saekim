import { countKoreanAwareWords, readingTime } from '../../lib/format/readingTime';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';

export function StatusBar() {
  const activeFile = useWorkspaceStore(selectActiveFile);
  const dirty = isDirty(activeFile);
  const content = activeFile?.content ?? '';
  const language = activeFile?.name.endsWith('.txt') ? 'Text' : 'Markdown';

  return (
    <footer className="statusbar">
      <span className="item">
        <span className="dot" style={{ background: dirty ? 'var(--warning)' : 'var(--success)' }} />
        {dirty ? '저장 안 됨' : '저장됨'}
      </span>
      <span className="sep" />
      <span className="item">{language}</span>
      <span className="sep" />
      <span className="item">{activeFile?.encoding ?? 'UTF-8'} · {activeFile?.eol ?? 'LF'}</span>
      <div className="right">
        <span className="item" id="cursor-position">Ln 1, Col 1</span>
        <span className="sep" />
        <span className="item">{countKoreanAwareWords(content)} 단어</span>
        <span className="sep" />
        <span className="item">{readingTime(content)}</span>
      </div>
    </footer>
  );
}
