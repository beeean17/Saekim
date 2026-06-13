import { useLayoutEffect, useState, type RefObject } from 'react';
import { getEditorRowHeight, lineHeightsEqual, measureWrappedLineHeights } from '../core/editor/lineMetrics';

interface UseLineNumberSyncOptions {
  readonly editorFontFamily: string;
  readonly fontSize: number;
  readonly rootRef: RefObject<HTMLDivElement>;
  readonly textareaRef: RefObject<HTMLTextAreaElement>;
  readonly value: string;
}

export function useLineNumberSync({
  editorFontFamily,
  fontSize,
  rootRef,
  textareaRef,
  value,
}: UseLineNumberSyncOptions): number[] {
  const [lineNumberHeights, setLineNumberHeights] = useState<number[]>([]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const textarea = textareaRef.current;
    if (!root || !textarea) return;

    let disposed = false;

    const syncEditorMetrics = () => {
      if (disposed) return;

      const computedStyle = window.getComputedStyle(textarea);
      const rowHeight = getEditorRowHeight(computedStyle);
      if (!rowHeight) return;

      root.style.setProperty('--editor-row-height', `${rowHeight}px`);
      const nextLineHeights = measureWrappedLineHeights(textarea, value, rowHeight);
      const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
      const documentHeight = nextLineHeights.reduce((total, height) => total + height, paddingTop + paddingBottom);

      root.style.setProperty('--editor-document-height', `${documentHeight}px`);
      setLineNumberHeights((current) => (lineHeightsEqual(current, nextLineHeights) ? current : nextLineHeights));
    };

    syncEditorMetrics();
    const resizeObserver = new ResizeObserver(syncEditorMetrics);
    resizeObserver.observe(textarea);
    void document.fonts?.ready.then(syncEditorMetrics);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
    };
  }, [editorFontFamily, fontSize, rootRef, textareaRef, value]);

  return lineNumberHeights;
}
