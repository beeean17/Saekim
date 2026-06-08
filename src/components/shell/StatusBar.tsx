import { countKoreanAwareWords, readingTime } from '../../core/format/readingTime';
import { pdfExportStatusText, usePdfExportStore } from '../../features/pdf-export';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';

export function StatusBar() {
  const activeFile = useWorkspaceStore(selectActiveFile);
  const pdfExportStatus = usePdfExportStore((state) => state.status);
  const dirty = isDirty(activeFile);
  const content = activeFile?.content ?? '';
  const language = activeFile?.name.endsWith('.txt') ? 'Text' : 'Markdown';
  const pdfStatusText = pdfExportStatusText(pdfExportStatus);

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
      {pdfStatusText ? (
        <>
          <span className="sep" />
          <span className={`item pdf-export-status ${pdfExportStatus}`}>{pdfStatusText}</span>
        </>
      ) : null}
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
