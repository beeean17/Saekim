import { RefObject, useEffect } from 'react';

const bottomSyncThreshold = 48;
const programmaticGuardMs = 140;
const inputSelectionQuietMs = 140;
const inputScrollQuietMs = 100;
const whitespaceCharCodes = new Set([9, 10, 13, 32]);

type ScrollPanel = 'editor' | 'preview';

type PendingSync = {
  sourcePanel: ScrollPanel;
  preferCaret: boolean;
};

type PreviewAnchor = {
  line: number;
  endLine: number;
  top: number;
  bottom: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getMaxScroll(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function getScrollRatio(element: HTMLElement): number {
  const maxScroll = getMaxScroll(element);
  return maxScroll <= 0 ? 0 : clamp(element.scrollTop / maxScroll, 0, 1);
}

function isNearBottom(element: HTMLElement): boolean {
  return getMaxScroll(element) - element.scrollTop <= bottomSyncThreshold;
}

function isFocusedTextAreaAtDocumentEnd(element: HTMLElement): boolean {
  if (!(element instanceof HTMLTextAreaElement) || document.activeElement !== element) return false;

  const cursorEnd = Math.max(element.selectionStart, element.selectionEnd);
  const { value } = element;
  for (let index = cursorEnd; index < value.length; index += 1) {
    if (!whitespaceCharCodes.has(value.charCodeAt(index))) return false;
  }
  return true;
}

function getLineCount(textarea: HTMLTextAreaElement): number {
  let count = 1;
  const { value } = textarea;
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 10) count += 1;
  }
  return count;
}

function getTextareaLineHeight(textarea: HTMLTextAreaElement): number {
  const styles = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight);
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;

  const fontSize = Number.parseFloat(styles.fontSize);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.5 : 20;
}

function getTextareaPaddingTop(textarea: HTMLTextAreaElement): number {
  const paddingTop = Number.parseFloat(window.getComputedStyle(textarea).paddingTop);
  return Number.isFinite(paddingTop) ? paddingTop : 0;
}

function getEditorVisibleLine(textarea: HTMLTextAreaElement): number {
  const lineHeight = getTextareaLineHeight(textarea);
  const paddingTop = getTextareaPaddingTop(textarea);
  const line = Math.floor(Math.max(0, textarea.scrollTop - paddingTop) / lineHeight) + 1;
  return clamp(line, 1, getLineCount(textarea));
}

function getEditorCaretLine(textarea: HTMLTextAreaElement): number {
  const caretIndex = clamp(Math.max(textarea.selectionStart, textarea.selectionEnd), 0, textarea.value.length);
  let line = 1;
  for (let index = 0; index < caretIndex; index += 1) {
    if (textarea.value.charCodeAt(index) === 10) line += 1;
  }
  return clamp(line, 1, getLineCount(textarea));
}

function getEditorLineTop(textarea: HTMLTextAreaElement, line: number): number {
  return getTextareaPaddingTop(textarea) + (line - 1) * getTextareaLineHeight(textarea);
}

function getEditorLineViewportRatio(textarea: HTMLTextAreaElement, line: number): number {
  if (textarea.clientHeight <= 0) return 0;
  const lineTop = getEditorLineTop(textarea, line);
  return clamp((lineTop - textarea.scrollTop) / textarea.clientHeight, 0.06, 0.92);
}

function collectPreviewAnchors(preview: HTMLElement): PreviewAnchor[] {
  const previewRect = preview.getBoundingClientRect();
  const elements = Array.from(
    preview.querySelectorAll<HTMLElement>(
      'h1[data-source-line], h2[data-source-line], h3[data-source-line], h4[data-source-line], h5[data-source-line], h6[data-source-line], p[data-source-line], li[data-source-line], blockquote[data-source-line], pre[data-source-line], table[data-source-line], hr[data-source-line], .math-block[data-source-line], .mermaid-block[data-source-line]',
    ),
  );

  return elements
    .map((element) => {
      const line = Number.parseInt(element.dataset.sourceLine ?? '', 10);
      const endLine = Number.parseInt(element.dataset.sourceEndLine ?? '', 10);
      const rect = element.getBoundingClientRect();
      const top = rect.top - previewRect.top + preview.scrollTop;
      const bottom = rect.bottom - previewRect.top + preview.scrollTop;
      return {
        line,
        endLine: Number.isFinite(endLine) ? Math.max(line, endLine) : line,
        top,
        bottom: Math.max(top + 1, bottom),
      };
    })
    .filter((anchor) => Number.isFinite(anchor.line) && anchor.line > 0)
    .sort((a, b) => a.top - b.top || a.line - b.line);
}

function getNearestAnchorForLine(anchors: PreviewAnchor[], line: number): PreviewAnchor | null {
  const candidates = anchors.filter((anchor) => line >= anchor.line && line <= anchor.endLine);
  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      const spanDiff = a.endLine - a.line - (b.endLine - b.line);
      if (spanDiff !== 0) return spanDiff;
      return a.bottom - a.top - (b.bottom - b.top);
    });
    return candidates[0];
  }

  let previous: PreviewAnchor | null = null;
  let next: PreviewAnchor | null = null;
  for (const anchor of anchors) {
    if (anchor.line <= line) previous = anchor;
    if (anchor.line > line) {
      next = anchor;
      break;
    }
  }

  return previous ?? next;
}

function getPreviewYForLine(preview: HTMLElement, anchors: PreviewAnchor[], line: number, lineCount: number): number | null {
  if (anchors.length === 0) return null;

  const containing = getNearestAnchorForLine(anchors, line);
  if (containing && line >= containing.line && line <= containing.endLine) {
    const sourceSpan = Math.max(1, containing.endLine - containing.line);
    const visualSpan = Math.max(1, containing.bottom - containing.top);
    const ratio = clamp((line - containing.line) / sourceSpan, 0, 1);
    return containing.top + visualSpan * ratio;
  }

  let previous = anchors[0];
  let next = anchors[anchors.length - 1];
  for (const anchor of anchors) {
    if (anchor.line <= line) previous = anchor;
    if (anchor.line > line) {
      next = anchor;
      break;
    }
  }

  if (previous && next && previous !== next && next.line !== previous.line) {
    const ratio = clamp((line - previous.line) / (next.line - previous.line), 0, 1);
    return previous.top + (next.top - previous.top) * ratio;
  }

  const ratio = lineCount <= 1 ? 0 : (line - 1) / (lineCount - 1);
  return ratio * getMaxScroll(preview);
}

function getSourceLineForPreviewTop(preview: HTMLElement, anchors: PreviewAnchor[], lineCount: number): number | null {
  if (anchors.length === 0) return null;

  const viewportTop = preview.scrollTop;
  const containing = anchors.find((anchor) => viewportTop >= anchor.top && viewportTop <= anchor.bottom);
  if (containing) {
    const visualSpan = Math.max(1, containing.bottom - containing.top);
    const sourceSpan = Math.max(1, containing.endLine - containing.line);
    const ratio = clamp((viewportTop - containing.top) / visualSpan, 0, 1);
    return clamp(Math.round(containing.line + sourceSpan * ratio), 1, lineCount);
  }

  let previous: PreviewAnchor | null = null;
  let next: PreviewAnchor | null = null;
  for (const anchor of anchors) {
    if (anchor.top <= viewportTop) previous = anchor;
    if (anchor.top > viewportTop) {
      next = anchor;
      break;
    }
  }

  if (previous && next && next.top !== previous.top) {
    const ratio = clamp((viewportTop - previous.top) / (next.top - previous.top), 0, 1);
    return clamp(Math.round(previous.line + (next.line - previous.line) * ratio), 1, lineCount);
  }

  if (previous) return clamp(previous.line, 1, lineCount);
  if (next) return clamp(next.line, 1, lineCount);
  return null;
}

export function useScrollSync(
  firstRef: RefObject<HTMLElement>,
  secondRef: RefObject<HTMLElement>,
  enabled: boolean,
): void {
  useEffect(() => {
    const editor = firstRef.current;
    const preview = secondRef.current;
    if (!(editor instanceof HTMLTextAreaElement) || !preview || !enabled) return;

    let previewAnchors = collectPreviewAnchors(preview);
    let activeScroller: ScrollPanel | null = null;
    let pending: PendingSync | null = null;
    let frame = 0;
    let releaseFrame = 0;
    let programmaticTarget: HTMLElement | null = null;
    let lastProgrammaticTarget: HTMLElement | null = null;
    let programmaticUntil = 0;
    let lastInputAt = 0;

    const refreshPreviewAnchors = () => {
      previewAnchors = collectPreviewAnchors(preview);
    };

    const isProgrammaticScroll = (element: HTMLElement) =>
      element === programmaticTarget || (element === lastProgrammaticTarget && performance.now() < programmaticUntil);

    const releaseProgrammaticGuard = (target: HTMLElement) => {
      programmaticTarget = target;
      lastProgrammaticTarget = target;
      programmaticUntil = performance.now() + programmaticGuardMs;
      if (releaseFrame) window.cancelAnimationFrame(releaseFrame);
      releaseFrame = window.requestAnimationFrame(() => {
        releaseFrame = window.requestAnimationFrame(() => {
          releaseFrame = 0;
          if (programmaticTarget === target) programmaticTarget = null;
        });
      });
    };

    const applyProgrammaticScroll = (target: HTMLElement, nextScrollTop: number) => {
      const maxScroll = getMaxScroll(target);
      const clampedTop = clamp(nextScrollTop, 0, maxScroll);
      if (Math.abs(target.scrollTop - clampedTop) < 0.5) return;
      target.scrollTop = clampedTop;
      releaseProgrammaticGuard(target);
    };

    const applyFallbackRatio = (source: HTMLElement, target: HTMLElement) => {
      applyProgrammaticScroll(target, getScrollRatio(source) * getMaxScroll(target));
    };

    const syncEditorToPreview = (preferCaret: boolean) => {
      if (getMaxScroll(preview) <= 0) return;

      const lineCount = getLineCount(editor);
      const shouldPinBottom = isNearBottom(editor) || isFocusedTextAreaAtDocumentEnd(editor);
      if (shouldPinBottom) {
        applyProgrammaticScroll(preview, getMaxScroll(preview));
        return;
      }

      const line = preferCaret && document.activeElement === editor ? getEditorCaretLine(editor) : getEditorVisibleLine(editor);
      const previewTop = getPreviewYForLine(preview, previewAnchors, line, lineCount);
      if (previewTop === null) {
        applyFallbackRatio(editor, preview);
        return;
      }

      const viewportRatio = preferCaret ? getEditorLineViewportRatio(editor, line) : 0;
      applyProgrammaticScroll(preview, previewTop - preview.clientHeight * viewportRatio);
    };

    const syncPreviewToEditor = () => {
      if (getMaxScroll(editor) <= 0) return;

      if (isNearBottom(preview)) {
        applyProgrammaticScroll(editor, getMaxScroll(editor));
        return;
      }

      const lineCount = getLineCount(editor);
      const sourceLine = getSourceLineForPreviewTop(preview, previewAnchors, lineCount);
      if (sourceLine === null) {
        applyFallbackRatio(preview, editor);
        return;
      }

      applyProgrammaticScroll(editor, getEditorLineTop(editor, sourceLine));
    };

    const flush = () => {
      frame = 0;
      if (!pending) return;
      const next = pending;
      pending = null;

      if (next.sourcePanel === 'editor') {
        syncEditorToPreview(next.preferCaret);
      } else {
        syncPreviewToEditor();
      }
    };

    const scheduleSync = (sourcePanel: ScrollPanel, preferCaret = false) => {
      activeScroller = sourcePanel;
      pending = { sourcePanel, preferCaret };
      if (frame) return;
      frame = window.requestAnimationFrame(flush);
    };

    const cancelPendingSync = () => {
      pending = null;
      if (!frame) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const syncNow = (sourcePanel: ScrollPanel, preferCaret = false) => {
      activeScroller = sourcePanel;
      cancelPendingSync();
      if (sourcePanel === 'editor') {
        syncEditorToPreview(preferCaret);
      } else {
        syncPreviewToEditor();
      }
    };

    const handleEditorScroll = () => {
      if (isProgrammaticScroll(editor)) return;
      if (document.activeElement === editor && performance.now() - lastInputAt < inputScrollQuietMs) return;
      scheduleSync('editor');
    };

    const handlePreviewScroll = () => {
      if (isProgrammaticScroll(preview)) return;
      scheduleSync('preview');
    };

    const handleEditorInput = () => {
      lastInputAt = performance.now();
      activeScroller = 'editor';
      cancelPendingSync();
    };

    const handleSelectionChange = () => {
      if (document.activeElement !== editor) return;
      if (performance.now() - lastInputAt < inputSelectionQuietMs) return;
      scheduleSync('editor', true);
    };

    const handlePreviewRendered = () => {
      refreshPreviewAnchors();
      if (document.activeElement === editor) {
        syncNow('editor', true);
        return;
      }
      if (activeScroller === 'preview') {
        syncNow('preview');
        return;
      }
      syncNow('editor');
    };

    const handlePreviewResize = () => {
      refreshPreviewAnchors();
      if (activeScroller === 'preview') {
        scheduleSync('preview');
        return;
      }
      scheduleSync('editor', document.activeElement === editor);
    };

    const resizeObserver = new ResizeObserver(handlePreviewResize);
    resizeObserver.observe(preview);
    preview.addEventListener('saekim-preview-rendered', handlePreviewRendered);
    editor.addEventListener('scroll', handleEditorScroll, { passive: true });
    editor.addEventListener('input', handleEditorInput);
    document.addEventListener('selectionchange', handleSelectionChange);
    preview.addEventListener('scroll', handlePreviewScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (releaseFrame) window.cancelAnimationFrame(releaseFrame);
      resizeObserver.disconnect();
      preview.removeEventListener('saekim-preview-rendered', handlePreviewRendered);
      editor.removeEventListener('scroll', handleEditorScroll);
      editor.removeEventListener('input', handleEditorInput);
      document.removeEventListener('selectionchange', handleSelectionChange);
      preview.removeEventListener('scroll', handlePreviewScroll);
    };
  }, [enabled, firstRef, secondRef]);
}
