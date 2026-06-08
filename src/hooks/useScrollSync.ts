import { RefObject, useEffect } from 'react';

type ScrollSource = 'editor' | 'preview';

interface PreviewAnchor {
  line: number;
  endLine: number;
  top: number;
  height: number;
}

interface PendingSync {
  source: ScrollSource;
  reason: 'scroll' | 'selection' | 'render' | 'resize';
}

interface RenderAnchor {
  line: number;
  keepBottom: boolean;
  scrollTop: number;
  time: number;
}

const PROGRAMMATIC_SCROLL_MS = 120;
const INPUT_RENDER_WINDOW_MS = 700;
const BOTTOM_THRESHOLD_PX = 48;
const ANCHOR_OFFSET_PX = 8;
const INPUT_AUTOSCROLL_THRESHOLD_PX = 160;

export function useScrollSync(
  editorRef: RefObject<HTMLElement>,
  previewRef: RefObject<HTMLElement>,
  enabled: boolean,
): void {
  useEffect(() => {
    const editor = editorRef.current as HTMLTextAreaElement | null;
    const preview = previewRef.current;
    if (!editor || !preview || !enabled) return;

    let pendingFrame = 0;
    let pendingSync: PendingSync | null = null;
    let activeScroller: ScrollSource | null = null;
    let programmaticTarget: HTMLElement | null = null;
    let programmaticUntil = 0;
    let renderAnchor: RenderAnchor | null = null;

    const isProgrammaticEvent = (target: HTMLElement) => {
      if (target !== programmaticTarget) return false;
      if (performance.now() > programmaticUntil) return false;
      return true;
    };

    const applyScrollTop = (target: HTMLElement, scrollTop: number) => {
      const nextScrollTop = clamp(scrollTop, 0, getMaxScroll(target));
      if (Math.abs(target.scrollTop - nextScrollTop) < 0.5) return;
      programmaticTarget = target;
      programmaticUntil = performance.now() + PROGRAMMATIC_SCROLL_MS;
      target.scrollTop = nextScrollTop;
    };

    const syncFromEditor = (reason: PendingSync['reason']) => {
      const maxPreview = getMaxScroll(preview);
      if (maxPreview <= 0) return;

      const line = reason === 'render' ? renderAnchor?.line ?? getCaretLine(editor) : getEditorVisibleLine(editor);
      const shouldKeepBottom =
        reason === 'render' &&
        Boolean(renderAnchor?.keepBottom) &&
        getCaretLine(editor) >= getEditorLineCount(editor) - 1 &&
        isNearBottom(editor, BOTTOM_THRESHOLD_PX * 2);

      if (shouldKeepBottom) {
        applyScrollTop(preview, maxPreview);
        return;
      }

      const anchors = collectPreviewAnchors(preview);
      const targetTop =
        anchors.length > 0
          ? getPreviewTopForLine(line, anchors, getEditorLineCount(editor), maxPreview)
          : getScrollByRatio(editor, preview);

      applyScrollTop(preview, targetTop);
    };

    const syncFromPreview = () => {
      const maxEditor = getMaxScroll(editor);
      if (maxEditor <= 0) return;

      const anchors = collectPreviewAnchors(preview);
      const targetTop =
        anchors.length > 0
          ? getEditorTopForLine(editor, getLineForPreviewTop(preview.scrollTop + ANCHOR_OFFSET_PX, anchors, getEditorLineCount(editor), getMaxScroll(preview)))
          : getScrollByRatio(preview, editor);

      applyScrollTop(editor, targetTop);
    };

    const flush = () => {
      pendingFrame = 0;
      const next = pendingSync;
      pendingSync = null;
      if (!next) return;

      if (next.source === 'editor') syncFromEditor(next.reason);
      if (next.source === 'preview') syncFromPreview();
    };

    const scheduleSync = (source: ScrollSource, reason: PendingSync['reason']) => {
      pendingSync = { source, reason };
      if (pendingFrame) return;
      pendingFrame = window.requestAnimationFrame(flush);
    };

    const syncNow = (source: ScrollSource, reason: PendingSync['reason']) => {
      if (pendingFrame) {
        window.cancelAnimationFrame(pendingFrame);
        pendingFrame = 0;
      }
      pendingSync = { source, reason };
      flush();
    };

    const onEditorScroll = () => {
      if (isProgrammaticEvent(editor)) return;
      activeScroller = 'editor';
      if (
        renderAnchor &&
        performance.now() - renderAnchor.time < INPUT_RENDER_WINDOW_MS &&
        Math.abs(editor.scrollTop - renderAnchor.scrollTop) < INPUT_AUTOSCROLL_THRESHOLD_PX
      ) {
        return;
      }
      scheduleSync('editor', 'scroll');
    };

    const onPreviewScroll = () => {
      if (isProgrammaticEvent(preview)) return;
      activeScroller = 'preview';
      scheduleSync('preview', 'scroll');
    };

    const onEditorInput = () => {
      activeScroller = 'editor';
      renderAnchor = {
        line: getEditorVisibleLine(editor),
        keepBottom: isNearBottom(editor, BOTTOM_THRESHOLD_PX),
        scrollTop: editor.scrollTop,
        time: performance.now(),
      };
    };

    const onSelectionChange = () => {
      if (document.activeElement !== editor) return;
      if (renderAnchor && performance.now() - renderAnchor.time < INPUT_RENDER_WINDOW_MS) return;
      activeScroller = 'editor';
      scheduleSync('editor', 'selection');
    };

    const onPreviewRendered = () => {
      if (renderAnchor && performance.now() - renderAnchor.time < INPUT_RENDER_WINDOW_MS) {
        activeScroller = 'editor';
        return;
      }

      if (activeScroller === 'preview') {
        syncNow('preview', 'render');
        return;
      }

      syncNow('editor', 'render');
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync(activeScroller ?? 'editor', 'resize');
    });

    editor.addEventListener('scroll', onEditorScroll, { passive: true });
    editor.addEventListener('input', onEditorInput);
    preview.addEventListener('scroll', onPreviewScroll, { passive: true });
    preview.addEventListener('saekim-preview-rendered', onPreviewRendered);
    document.addEventListener('selectionchange', onSelectionChange);
    resizeObserver.observe(preview);

    return () => {
      if (pendingFrame) window.cancelAnimationFrame(pendingFrame);
      editor.removeEventListener('scroll', onEditorScroll);
      editor.removeEventListener('input', onEditorInput);
      preview.removeEventListener('scroll', onPreviewScroll);
      preview.removeEventListener('saekim-preview-rendered', onPreviewRendered);
      document.removeEventListener('selectionchange', onSelectionChange);
      resizeObserver.disconnect();
    };
  }, [enabled, editorRef, previewRef]);
}

function collectPreviewAnchors(preview: HTMLElement): PreviewAnchor[] {
  const previewRect = preview.getBoundingClientRect();
  return Array.from(preview.querySelectorAll<HTMLElement>('[data-source-line]'))
    .map((element) => {
      const line = Number(element.dataset.sourceLine);
      const endLine = Number(element.dataset.sourceEndLine || line);
      const rect = element.getBoundingClientRect();
      return {
        line,
        endLine: Math.max(line, endLine),
        top: rect.top - previewRect.top + preview.scrollTop,
        height: rect.height,
      };
    })
    .filter((anchor) => Number.isFinite(anchor.line) && anchor.line > 0)
    .sort((a, b) => a.line - b.line || a.top - b.top);
}

function getPreviewTopForLine(line: number, anchors: PreviewAnchor[], lineCount: number, maxPreview: number): number {
  const targetLine = clamp(line, 1, lineCount);
  const first = anchors[0];
  if (targetLine <= first.line) return 0;

  for (let index = 0; index < anchors.length; index += 1) {
    const current = anchors[index];
    const next = anchors[index + 1];

    if (targetLine >= current.line && targetLine <= current.endLine) {
      const span = Math.max(1, current.endLine - current.line + 1);
      return current.top + current.height * ((targetLine - current.line) / span);
    }

    if (next && targetLine > current.line && targetLine < next.line) {
      const ratio = (targetLine - current.line) / Math.max(1, next.line - current.line);
      return current.top + (next.top - current.top) * ratio;
    }
  }

  const last = anchors[anchors.length - 1];
  const tailLines = Math.max(1, lineCount - last.line);
  const tailRatio = (targetLine - last.line) / tailLines;
  return last.top + (maxPreview - last.top) * tailRatio;
}

function getLineForPreviewTop(top: number, anchors: PreviewAnchor[], lineCount: number, maxPreview: number): number {
  const first = anchors[0];
  if (top <= first.top) return first.line;

  for (let index = 0; index < anchors.length; index += 1) {
    const current = anchors[index];
    const next = anchors[index + 1];
    const currentBottom = current.top + current.height;

    if (top >= current.top && top <= currentBottom) {
      const ratio = current.height > 0 ? (top - current.top) / current.height : 0;
      return Math.round(current.line + (current.endLine - current.line) * ratio);
    }

    if (next && top > currentBottom && top < next.top) {
      const ratio = (top - currentBottom) / Math.max(1, next.top - currentBottom);
      return Math.round(current.endLine + (next.line - current.endLine) * ratio);
    }
  }

  const last = anchors[anchors.length - 1];
  const tailRatio = (top - last.top) / Math.max(1, maxPreview - last.top);
  return Math.round(last.line + (lineCount - last.line) * tailRatio);
}

function getEditorVisibleLine(editor: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(editor);
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const lineHeight = getLineHeight(editor, style);
  return clamp(Math.floor((editor.scrollTop + ANCHOR_OFFSET_PX - paddingTop) / lineHeight) + 1, 1, getEditorLineCount(editor));
}

function getCaretLine(editor: HTMLTextAreaElement): number {
  return getLineAtIndex(editor.value, editor.selectionStart);
}

function getEditorTopForLine(editor: HTMLTextAreaElement, line: number): number {
  const style = window.getComputedStyle(editor);
  const paddingTop = parseFloat(style.paddingTop) || 0;
  return paddingTop + (clamp(line, 1, getEditorLineCount(editor)) - 1) * getLineHeight(editor, style);
}

function getEditorLineCount(editor: HTMLTextAreaElement): number {
  return Math.max(1, editor.value.split('\n').length);
}

function getLineAtIndex(text: string, index: number): number {
  const clamped = clamp(index, 0, text.length);
  let line = 1;
  for (let i = 0; i < clamped; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function getLineHeight(editor: HTMLTextAreaElement, style = window.getComputedStyle(editor)): number {
  const parsed = parseFloat(style.lineHeight);
  if (Number.isFinite(parsed)) return parsed;
  const fontSize = parseFloat(style.fontSize) || 13.5;
  return fontSize * 1.75;
}

function getScrollByRatio(source: HTMLElement, target: HTMLElement): number {
  const sourceMax = getMaxScroll(source);
  const targetMax = getMaxScroll(target);
  if (sourceMax <= 0 || targetMax <= 0) return 0;
  return targetMax * (source.scrollTop / sourceMax);
}

function getMaxScroll(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function isNearBottom(element: HTMLElement, threshold: number): boolean {
  return getMaxScroll(element) - element.scrollTop <= threshold;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
