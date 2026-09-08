import type { RefObject } from 'react';
import { countKoreanAwareWords } from '../../core/format/readingTime';
import { pdfExportStatusText, usePdfExportStore } from '../../features/pdf-export';
import { useCursorPosition } from '../../hooks/useCursorPosition';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';

export function StatusBar({ textareaRef }: { readonly textareaRef: RefObject<HTMLTextAreaElement> }) {
  const activeFile = useWorkspaceStore(selectActiveFile);
  const pdfExportStatus = usePdfExportStore((state) => state.status);
  const dirty = isDirty(activeFile);
  const content = activeFile?.content ?? '';
  const language = activeFile?.name.endsWith('.txt') ? 'Text' : 'Markdown';
  const pdfStatusText = pdfExportStatusText(pdfExportStatus);
  const cursor = useCursorPosition(content, textareaRef);

  return (
    <footer className="statusbar">
      <span className="item">
        <span className="dot" style={{ background: dirty ? 'var(--warning)' : 'var(--success)' }} />
        {dirty ? '저장 안 됨' : '저장됨'}
      </span>
      <span className="sep" />
      <span className="item">{language}</span>
      <span className="sep" />
      <span className="item">
        {activeFile?.encoding ?? 'UTF-8'} · {activeFile?.hasMixedEol ? 'Mixed' : (activeFile?.eol ?? 'LF')}
      </span>
      {pdfStatusText ? (
        <>
          <span className="sep" />
          <span className={`item pdf-export-status ${pdfExportStatus}`}>{pdfStatusText}</span>
        </>
      ) : null}
      <div className="right">
        <span className="item" id="cursor-position">
          Ln {cursor.row}, Col {cursor.column}
        </span>
        <span className="sep" />
        <span className="item">{countKoreanAwareWords(content)} 단어</span>
      </div>
    </footer>
  );
}
