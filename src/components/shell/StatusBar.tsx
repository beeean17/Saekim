import type { RefObject } from 'react';
import { enabledFeatures } from '../../app/featureRegistry';
import { getFileTypeLabel } from '../../core/document/fileType';
import { countKoreanAwareWords } from '../../core/format/readingTime';
import { pdfExportStatusText, usePdfExportStore } from '../../features/pdf-export';
import { useCursorPosition } from '../../hooks/useCursorPosition';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { useI18n } from '../../i18n/useI18n';

export function StatusBar({
  android,
  textareaRef,
}: {
  readonly android: boolean;
  readonly textareaRef: RefObject<HTMLTextAreaElement>;
}) {
  const { language, t } = useI18n();
  const activeFile = useWorkspaceStore(selectActiveFile);
  const setEncoding = useWorkspaceStore((state) => state.setEncoding);
  const pdfExportStatus = usePdfExportStore((state) => state.status);
  const dirty = isDirty(activeFile);
  const content = activeFile?.content ?? '';
  const fileTypeLabel = activeFile ? getFileTypeLabel(activeFile.name, activeFile.path, enabledFeatures) : '-';
  const pdfStatusText = pdfExportStatusText(pdfExportStatus, language);
  const cursor = useCursorPosition(content, textareaRef);

  return (
    <footer className={`statusbar ${android ? 'statusbar-android' : ''}`.trim()}>
      {/*
        With no document there is nothing to be saved or unsaved, so the bar
        says so instead of claiming "Saved" next to a reassuring green dot.
      */}
      <span className="item statusbar-save-state">
        <span
          className="dot"
          style={{ background: activeFile ? (dirty ? 'var(--warning)' : 'var(--success)') : 'var(--text-decorative)' }}
        />
        {activeFile ? (dirty ? t('document.unsaved') : t('document.saved')) : t('document.noDocument')}
      </span>
      <span className="sep" />
      <span className="item statusbar-file-type">{fileTypeLabel}</span>
      <span className="sep" />
      <span className="item statusbar-document-format">
        <select
          aria-label={t('document.encoding')}
          className="statusbar-encoding"
          disabled={!activeFile}
          title={t('document.changeEncoding')}
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
        {!android ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{activeFile?.hasMixedEol ? 'Mixed' : (activeFile?.eol ?? 'LF')}</span>
          </>
        ) : null}
      </span>
      {pdfStatusText ? (
        <>
          <span className="sep" />
          <span className={`item pdf-export-status ${pdfExportStatus}`}>{pdfStatusText}</span>
        </>
      ) : null}
      <div className="right">
        {android ? (
          <>
            <span className="item statusbar-file-name" title={activeFile?.name}>
              {activeFile?.name ?? '-'}
            </span>
            <span className="sep statusbar-word-separator" />
            <span className="item statusbar-word-count">
              {t('document.words', { count: countKoreanAwareWords(content) })}
            </span>
          </>
        ) : (
          <>
            <span className="item statusbar-cursor" id="cursor-position">
              Ln {cursor.row}, Col {cursor.column}
            </span>
            <span className="sep statusbar-word-separator" />
            <span className="item statusbar-word-count">
              {t('document.words', { count: countKoreanAwareWords(content) })}
            </span>
          </>
        )}
      </div>
    </footer>
  );
}
