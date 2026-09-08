import { RefObject, useEffect } from 'react';
import { editorLineMetricStyleKey, measureEditorLineMetrics, type EditorLineMetrics } from '../core/editor/lineMetrics';

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

interface EditorLineMetricsCache {
  text: string;
  width: number;
  styleKey: string;
  metrics: EditorLineMetrics;
}

const PROGRAMMATIC_SCROLL_MS = 120;
const INPUT_RENDER_WINDOW_MS = 700;
const BOTTOM_THRESHOLD_PX = 48;
const ANCHOR_OFFSET_PX = 8;
const INPUT_AUTOSCROLL_THRESHOLD_PX = 160;

export function scrollEditorToSourceLine(
  editor: HTMLTextAreaElement,
  editorScroller: HTMLElement,
  line: number,
): void {
  const metrics = measureEditorLineMetrics(editor, editor.value, window.getComputedStyle(editor));
  editorScroller.scrollTo({
    top: Math.max(0, getEditorTopForLine(editor, line, metrics) - ANCHOR_OFFSET_PX),
    behavior: 'smooth',
  });
}

export function useScrollSync(
  editorRef: RefObject<HTMLTextAreaElement>,
  editorScrollRef: RefObject<HTMLElement>,
  previewRef: RefObject<HTMLElement>,
  enabled: boolean,
  syncKey: string | null = null,
  previewElement: HTMLElement | null = null,
): void {
  useEffect(() => {
    const editor = editorRef.current;
    const editorScroller = editorScrollRef.current;
    const preview = previewElement ?? previewRef.current;
    if (!editor || !editorScroller || !preview || !enabled) return;

    let pendingFrame = 0;
    let pendingSync: PendingSync | null = null;
    let activeScroller: ScrollSource | null = null;
    let programmaticTarget: HTMLElement | null = null;
    let programmaticUntil = 0;
    let renderAnchor: RenderAnchor | null = null;
    let editorMetricsCache: EditorLineMetricsCache | null = null;

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

    const getEditorMetrics = () => {
      const computedStyle = window.getComputedStyle(editor);
      const styleKey = editorLineMetricStyleKey(computedStyle);
      const text = editor.value;
      const width = editor.clientWidth;
      if (
        editorMetricsCache &&
        editorMetricsCache.text === text &&
        editorMetricsCache.width === width &&
        editorMetricsCache.styleKey === styleKey
      ) {
        return editorMetricsCache.metrics;
      }

      const metrics = measureEditorLineMetrics(editor, text, computedStyle);
      editorMetricsCache = { text, width, styleKey, metrics };
      return metrics;
    };

    const invalidateEditorMetrics = () => {
      editorMetricsCache = null;
    };

    const isWithinInputRenderWindow = () =>
      Boolean(renderAnchor && performance.now() - renderAnchor.time < INPUT_RENDER_WINDOW_MS);

    const syncFromEditor = (reason: PendingSync['reason']) => {
      const maxPreview = getMaxScroll(preview);
      if (maxPreview <= 0) return;

      if (isNearBottom(editorScroller, BOTTOM_THRESHOLD_PX)) {
        applyScrollTop(preview, maxPreview);
        return;
      }

      const metrics = getEditorMetrics();
      const line =
        reason === 'render' ? renderAnchor?.line ?? getCaretLine(editor) : getEditorVisibleLine(editorScroller.scrollTop, metrics);
      const shouldKeepBottom =
        reason === 'render' &&
        Boolean(renderAnchor?.keepBottom) &&
        getCaretLine(editor) >= getEditorLineCount(editor, metrics) - 1 &&
        isNearBottom(editorScroller, BOTTOM_THRESHOLD_PX * 2);

      if (shouldKeepBottom) {
        applyScrollTop(preview, maxPreview);
        return;
      }

      const anchors = collectPreviewAnchors(preview);
      const targetTop =
        anchors.length > 0
          ? getPreviewTopForLine(line, anchors, getEditorLineCount(editor, metrics), maxPreview)
          : getScrollByRatio(editorScroller, preview);

      applyScrollTop(preview, targetTop);
    };

    const syncFromPreview = () => {
      const maxEditor = getMaxScroll(editorScroller);
      if (maxEditor <= 0) return;

      if (isNearBottom(preview, BOTTOM_THRESHOLD_PX)) {
        applyScrollTop(editorScroller, maxEditor);
        return;
      }

      const metrics = getEditorMetrics();
      const anchors = collectPreviewAnchors(preview);
      const targetTop =
        anchors.length > 0
          ? getEditorTopForLine(
              editor,
              getLineForPreviewTop(preview.scrollTop + ANCHOR_OFFSET_PX, anchors, getEditorLineCount(editor, metrics), getMaxScroll(preview)),
              metrics,
            )
          : getScrollByRatio(preview, editorScroller);

      applyScrollTop(editorScroller, targetTop);
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
      if (isProgrammaticEvent(editorScroller)) return;
      activeScroller = 'editor';
      if (
        renderAnchor &&
        performance.now() - renderAnchor.time < INPUT_RENDER_WINDOW_MS &&
        Math.abs(editorScroller.scrollTop - renderAnchor.scrollTop) < INPUT_AUTOSCROLL_THRESHOLD_PX
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
      invalidateEditorMetrics();
      activeScroller = 'editor';
      renderAnchor = {
        line: getCaretLine(editor),
        keepBottom: isNearBottom(editorScroller, BOTTOM_THRESHOLD_PX),
        scrollTop: editorScroller.scrollTop,
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
      if (isWithinInputRenderWindow()) {
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
      invalidateEditorMetrics();
      if (isWithinInputRenderWindow()) return;
      scheduleSync(activeScroller ?? 'editor', 'resize');
    });

    editorScroller.addEventListener('scroll', onEditorScroll, { passive: true });
    editor.addEventListener('input', onEditorInput);
    preview.addEventListener('scroll', onPreviewScroll, { passive: true });
    preview.addEventListener('saekim-preview-rendered', onPreviewRendered);
    document.addEventListener('selectionchange', onSelectionChange);
    resizeObserver.observe(editor);
    resizeObserver.observe(editorScroller);
    resizeObserver.observe(preview);
    const initialFrame = window.requestAnimationFrame(() => syncNow('editor', 'render'));

    return () => {
      if (pendingFrame) window.cancelAnimationFrame(pendingFrame);
      window.cancelAnimationFrame(initialFrame);
      editorScroller.removeEventListener('scroll', onEditorScroll);
      editor.removeEventListener('input', onEditorInput);
      preview.removeEventListener('scroll', onPreviewScroll);
      preview.removeEventListener('saekim-preview-rendered', onPreviewRendered);
      document.removeEventListener('selectionchange', onSelectionChange);
      resizeObserver.disconnect();
    };
  }, [enabled, editorRef, editorScrollRef, previewElement, previewRef, syncKey]);
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

function getEditorVisibleLine(scrollTop: number, metrics: EditorLineMetrics): number {
  return getEditorLineForTop(scrollTop + ANCHOR_OFFSET_PX, metrics);
}

function getCaretLine(editor: HTMLTextAreaElement): number {
  return getLineAtIndex(editor.value, editor.selectionStart);
}

function getEditorTopForLine(editor: HTMLTextAreaElement, line: number, metrics: EditorLineMetrics): number {
  const targetLine = clamp(line, 1, getEditorLineCount(editor, metrics));
  return metrics.lineTops[targetLine - 1] ?? metrics.paddingTop;
}

function getEditorLineCount(editor: HTMLTextAreaElement, metrics?: EditorLineMetrics): number {
  return metrics?.lineHeights.length ?? Math.max(1, editor.value.split('\n').length);
}

function getLineAtIndex(text: string, index: number): number {
  const clamped = clamp(index, 0, text.length);
  let line = 1;
  for (let i = 0; i < clamped; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function getEditorLineForTop(top: number, metrics: EditorLineMetrics): number {
  const lineCount = Math.max(1, metrics.lineTops.length);
  if (top <= metrics.lineTops[0]) return 1;

  for (let index = 0; index < metrics.lineTops.length; index += 1) {
    const currentTop = metrics.lineTops[index];
    const nextTop = metrics.lineTops[index + 1] ?? Number.POSITIVE_INFINITY;
    if (top >= currentTop && top < nextTop) return index + 1;
  }

  return lineCount;
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
