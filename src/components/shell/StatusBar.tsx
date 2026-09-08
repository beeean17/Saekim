import type { RefObject } from 'react';
import { enabledFeatures } from '../../app/featureRegistry';
import { getFileTypeLabel } from '../../core/document/fileType';
import { countKoreanAwareWords } from '../../core/format/readingTime';
import { pdfExportStatusText, usePdfExportStore } from '../../features/pdf-export';
import { useCursorPosition } from '../../hooks/useCursorPosition';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';

export function StatusBar({ textareaRef }: { readonly textareaRef: RefObject<HTMLTextAreaElement> }) {
  const activeFile = useWorkspaceStore(selectActiveFile);
  const setEncoding = useWorkspaceStore((state) => state.setEncoding);
  const pdfExportStatus = usePdfExportStore((state) => state.status);
  const dirty = isDirty(activeFile);
  const content = activeFile?.content ?? '';
  const language = activeFile ? getFileTypeLabel(activeFile.name, activeFile.path, enabledFeatures) : '-';
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
      <span className="item statusbar-document-format">
        <select
          aria-label="문서 인코딩"
          className="statusbar-encoding"
          disabled={!activeFile}
          title="저장 인코딩 변경"
          value={activeFile?.encoding ?? 'utf-8'}
          onChange={(event) => {
            if (activeFile) setEncoding(activeFile.id, event.currentTarget.value as typeof activeFile.encoding);
          }}
        >
          <option value="utf-8">UTF-8</option>
          <option value="utf-8-bom">UTF-8 BOM</option>
          <option value="utf-16le">UTF-16 LE</option>
          <option value="utf-16be">UTF-16 BE</option>
        </select>
        <span aria-hidden="true">·</span>
        <span>{activeFile?.hasMixedEol ? 'Mixed' : (activeFile?.eol ?? 'LF')}</span>
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
