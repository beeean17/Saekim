import { useEffect, useState } from 'react';
import { Backend } from '../../platform/common/backend';
import type { OpenFile } from '../../types/workspace';
import { Dialog } from '../ui/overlay/Dialog';
import { CloseButton } from '../ui/primitives/CloseButton';
import { useI18n } from '../../i18n/useI18n';
import { appendBlockSnippet, isContentUriPath, localImagePreviewSrc } from './sidebarPaths';

export function ImagePreviewModal({
  canAddToDocument,
  image,
  onAddToDocument,
  onClose,
}: {
  canAddToDocument: boolean;
  image: { path: string; name: string };
  onAddToDocument: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [src, setSrc] = useState(() => localImagePreviewSrc(image.path));

  useEffect(() => {
    let cancelled = false;
    setSrc(localImagePreviewSrc(image.path));
    if (isContentUriPath(image.path)) {
      void Backend.images
        .resolveImageSrc(image.path)
        .then((resolved) => {
          if (!cancelled && resolved) setSrc(resolved);
        })
        .catch((error) => console.warn('failed to resolve image preview', error));
    }
    return () => {
      cancelled = true;
    };
  }, [image.path]);

  return (
    <Dialog
      open
      title={t('sidebar.imagePreview', { name: image.name })}
      className="image-preview-modal"
      backdropClassName="image-preview-backdrop"
      onClose={onClose}
    >
        <div className="image-preview-head">
          <div>
            <strong>{image.name}</strong>
            <span>{image.path}</span>
          </div>
          <div className="image-preview-actions">
            <button
              className="image-preview-add"
              disabled={!canAddToDocument}
              type="button"
              title={canAddToDocument ? t('sidebar.addImage') : t('sidebar.addImageFirst')}
              onClick={onAddToDocument}
            >
              {t('sidebar.addImage')}
            </button>
            <CloseButton className="image-preview-close" onClick={onClose}>
              x
            </CloseButton>
          </div>
        </div>
        <div className="image-preview-body">
          <img alt={image.name} src={src} />
        </div>
    </Dialog>
  );
}

export function insertImageSnippetIntoDocument(
  textarea: HTMLTextAreaElement | null,
  activeFile: OpenFile,
  updateContent: (id: string, text: string) => void,
  snippet: string,
): void {
  const value = textarea?.value ?? activeFile.content;
  const start = textarea ? textarea.selectionStart : value.length;
  const end = textarea ? textarea.selectionEnd : value.length;
  const insertion = textarea ? snippet : appendBlockSnippet(value, snippet);
  const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
  const cursor = start + insertion.length;

  updateContent(activeFile.id, next);

  if (!textarea) return;
  window.requestAnimationFrame(() => {
    textarea.focus();
    textarea.selectionStart = cursor;
    textarea.selectionEnd = cursor;
  });
}
