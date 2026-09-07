import { useEffect, useState, type RefObject } from 'react';
import { lineHeightsEqual, measureEditorRowHeight, measureWrappedLineHeights } from '../core/editor/lineMetrics';

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

  useEffect(() => {
    const root = rootRef.current;
    const textarea = textareaRef.current;
    if (!root || !textarea) return;

    let disposed = false;
    let animationFrame = 0;

    const syncEditorMetrics = () => {
      if (disposed) return;

      const computedStyle = window.getComputedStyle(textarea);
      const rowHeight = measureEditorRowHeight(textarea, computedStyle);
      if (!rowHeight) return;

      root.style.setProperty('--editor-row-height', `${rowHeight}px`);
      const nextLineHeights = measureWrappedLineHeights(textarea, value, rowHeight, computedStyle);
      const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
      const documentHeight = nextLineHeights.reduce((total, height) => total + height, paddingTop + paddingBottom);

      root.style.setProperty('--editor-document-height', `${documentHeight}px`);
      setLineNumberHeights((current) => (lineHeightsEqual(current, nextLineHeights) ? current : nextLineHeights));
    };

    const scheduleSyncEditorMetrics = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        syncEditorMetrics();
      });
    };

    scheduleSyncEditorMetrics();
    const resizeObserver = new ResizeObserver(scheduleSyncEditorMetrics);
    resizeObserver.observe(textarea);
    void document.fonts?.ready.then(scheduleSyncEditorMetrics);

    return () => {
      disposed = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [editorFontFamily, fontSize, rootRef, textareaRef, value]);

  return lineNumberHeights;
}
