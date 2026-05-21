import { RefObject, useEffect } from 'react';

const bottomSyncThreshold = 48;
const whitespaceCharCodes = new Set([9, 10, 13, 32]);

type CursorLineAnchor = {
  line: number;
  lineCount: number;
  viewportRatio: number;
};

function isFocusedTextAreaAtDocumentEnd(element: HTMLElement): boolean {
  if (!(element instanceof HTMLTextAreaElement) || document.activeElement !== element) return false;

  const cursorEnd = Math.max(element.selectionStart, element.selectionEnd);
  const { value } = element;
  for (let index = cursorEnd; index < value.length; index += 1) {
    const char = value.charCodeAt(index);
    if (!whitespaceCharCodes.has(char)) return false;
  }
  return true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getLineNumberAtIndex(text: string, index: number): number {
  let line = 1;
  const clampedIndex = clamp(index, 0, text.length);

  for (let i = 0; i < clampedIndex; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }

  return line;
}

function getLineCount(text: string): number {
  let count = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) count += 1;
  }
  return count;
}

function parsePixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTextareaLineHeight(textarea: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(lineHeight)) return lineHeight;

  const fontSize = Number.parseFloat(style.fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.5 : 24;
}

function getCursorLineAnchor(textarea: HTMLTextAreaElement): CursorLineAnchor {
  const cursorEnd = Math.max(textarea.selectionStart, textarea.selectionEnd);
  const line = getLineNumberAtIndex(textarea.value, cursorEnd);
  const lineCount = getLineCount(textarea.value);
  const style = window.getComputedStyle(textarea);
  const lineTop = parsePixelValue(style.paddingTop) + (line - 1) * getTextareaLineHeight(textarea);
  const viewportRatio = textarea.clientHeight > 0 ? clamp((lineTop - textarea.scrollTop) / textarea.clientHeight, 0, 1) : 0;

  return { line, lineCount, viewportRatio };
}

function getSourceLineElements(preview: HTMLElement): Array<{ line: number; top: number }> {
  const previewRect = preview.getBoundingClientRect();
  const anchors: Array<{ line: number; top: number }> = [];
  const seen = new Set<number>();

  preview.querySelectorAll<HTMLElement>('[data-source-line]').forEach((element) => {
    const sourceLine = Number.parseInt(element.dataset.sourceLine ?? '', 10);
    if (!Number.isFinite(sourceLine) || seen.has(sourceLine)) return;

    seen.add(sourceLine);
    anchors.push({
      line: sourceLine,
      top: element.getBoundingClientRect().top - previewRect.top + preview.scrollTop,
    });
  });

  return anchors.sort((first, second) => first.line - second.line);
}

function getPreviewTopForLine(preview: HTMLElement, line: number, lineCount: number): number | null {
  const anchors = getSourceLineElements(preview);
  if (anchors.length === 0) return null;

  const firstAnchor = anchors[0];
  if (line <= firstAnchor.line) {
    const leadingRatio = firstAnchor.line > 1 ? clamp((line - 1) / (firstAnchor.line - 1), 0, 1) : 0;
    return firstAnchor.top * leadingRatio;
  }

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const current = anchors[index];
    const next = anchors[index + 1];
    if (line < current.line || line > next.line) continue;

    const distance = next.line - current.line;
    const ratio = distance > 0 ? (line - current.line) / distance : 0;
    return current.top + (next.top - current.top) * ratio;
  }

  const lastAnchor = anchors[anchors.length - 1];
  if (line <= lastAnchor.line) return lastAnchor.top;

  const trailingLines = Math.max(1, lineCount - lastAnchor.line);
  const trailingRatio = clamp((line - lastAnchor.line) / trailingLines, 0, 1);
  return lastAnchor.top + (preview.scrollHeight - lastAnchor.top) * trailingRatio;
}

export function useScrollSync(
  firstRef: RefObject<HTMLElement>,
  secondRef: RefObject<HTMLElement>,
  enabled: boolean,
): void {
  useEffect(() => {
    const first = firstRef.current;
    const second = secondRef.current;
    if (!first || !second || !enabled) return;

    let frame = 0;
    let releaseFrame = 0;
    let suppressed: HTMLElement | null = null;
    let pending: { source: HTMLElement; target: HTMLElement } | null = null;
    let firstUserScrollUntil = 0;
    let secondUserScrollUntil = 0;

    const markFirstUserScroll = () => {
      firstUserScrollUntil = performance.now() + 250;
    };
    const markSecondUserScroll = () => {
      secondUserScrollUntil = performance.now() + 250;
    };

    const isUserScroll = (element: HTMLElement) => {
      const now = performance.now();
      return element === first ? now <= firstUserScrollUntil : now <= secondUserScrollUntil;
    };

    const shouldPinTargetToBottom = (source: HTMLElement, maxSource: number) => {
      const distanceToBottom = maxSource - source.scrollTop;
      return distanceToBottom <= bottomSyncThreshold || isFocusedTextAreaAtDocumentEnd(source);
    };

    const releaseSuppression = (target: HTMLElement) => {
      suppressed = target;
      if (releaseFrame) window.cancelAnimationFrame(releaseFrame);
      releaseFrame = window.requestAnimationFrame(() => {
        releaseFrame = window.requestAnimationFrame(() => {
          releaseFrame = 0;
          suppressed = null;
        });
      });
    };

    const pinTargetToBottom = (source: HTMLElement, target: HTMLElement) => {
      if (!isFocusedTextAreaAtDocumentEnd(source)) return false;

      const maxTarget = target.scrollHeight - target.clientHeight;
      if (maxTarget <= 0) return true;

      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        pending = null;
      }

      if (Math.abs(target.scrollTop - maxTarget) >= 0.5) {
        target.scrollTop = maxTarget;
      }
      releaseSuppression(target);
      return true;
    };

    const syncTargetToCursorLine = (source: HTMLElement, target: HTMLElement) => {
      if (!(source instanceof HTMLTextAreaElement) || document.activeElement !== source) return false;

      const maxTarget = target.scrollHeight - target.clientHeight;
      if (maxTarget <= 0) return true;

      const cursorLineAnchor = getCursorLineAnchor(source);
      const targetTop = getPreviewTopForLine(target, cursorLineAnchor.line, cursorLineAnchor.lineCount);
      if (targetTop === null) return false;

      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        pending = null;
      }

      const nextScrollTop = clamp(targetTop - cursorLineAnchor.viewportRatio * target.clientHeight, 0, maxTarget);
      if (Math.abs(target.scrollTop - nextScrollTop) >= 0.5) {
        target.scrollTop = nextScrollTop;
      }
      releaseSuppression(target);
      return true;
    };

    const flush = () => {
      frame = 0;
      if (!pending) return;
      const { source, target } = pending;
      pending = null;
      if (source === first && syncTargetToCursorLine(source, target)) return;

      const maxSource = source.scrollHeight - source.clientHeight;
      const maxTarget = target.scrollHeight - target.clientHeight;
      if (maxSource <= 0 || maxTarget <= 0) return;

      const nextScrollTop =
        shouldPinTargetToBottom(source, maxSource)
          ? maxTarget
          : (source.scrollTop / maxSource) * maxTarget;
      if (Math.abs(target.scrollTop - nextScrollTop) < 0.5) return;

      target.scrollTop = nextScrollTop;
      releaseSuppression(target);
    };

    const sync = (source: HTMLElement, target: HTMLElement) => {
      if (source === suppressed) return;
      if (target === first && document.activeElement === first && !isUserScroll(source)) return;
      pending = { source, target };
      if (frame) return;
      frame = window.requestAnimationFrame(flush);
    };
    const syncFirst = () => sync(first, second);
    const syncSecond = () => sync(second, first);
    const syncFirstIfFocused = () => {
      if (document.activeElement !== first) return;
      if (syncTargetToCursorLine(first, second) || pinTargetToBottom(first, second)) return;
      sync(first, second);
    };
    const syncCursorNavigation = (event: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
      sync(first, second);
    };

    const mutationObserver = new MutationObserver(syncFirstIfFocused);
    const resizeObserver = new ResizeObserver(syncFirstIfFocused);
    mutationObserver.observe(second, { childList: true });
    resizeObserver.observe(second);

    first.addEventListener('wheel', markFirstUserScroll, { passive: true });
    first.addEventListener('touchmove', markFirstUserScroll, { passive: true });
    first.addEventListener('pointerdown', markFirstUserScroll, { passive: true });
    first.addEventListener('keydown', markFirstUserScroll);
    first.addEventListener('keyup', syncCursorNavigation);
    first.addEventListener('mouseup', syncFirstIfFocused);
    second.addEventListener('wheel', markSecondUserScroll, { passive: true });
    second.addEventListener('touchmove', markSecondUserScroll, { passive: true });
    second.addEventListener('pointerdown', markSecondUserScroll, { passive: true });
    second.addEventListener('keydown', markSecondUserScroll);
    first.addEventListener('scroll', syncFirst, { passive: true });
    second.addEventListener('scroll', syncSecond, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (releaseFrame) window.cancelAnimationFrame(releaseFrame);
      first.removeEventListener('wheel', markFirstUserScroll);
      first.removeEventListener('touchmove', markFirstUserScroll);
      first.removeEventListener('pointerdown', markFirstUserScroll);
      first.removeEventListener('keydown', markFirstUserScroll);
      first.removeEventListener('keyup', syncCursorNavigation);
      first.removeEventListener('mouseup', syncFirstIfFocused);
      second.removeEventListener('wheel', markSecondUserScroll);
      second.removeEventListener('touchmove', markSecondUserScroll);
      second.removeEventListener('pointerdown', markSecondUserScroll);
      second.removeEventListener('keydown', markSecondUserScroll);
      first.removeEventListener('scroll', syncFirst);
      second.removeEventListener('scroll', syncSecond);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [enabled, firstRef, secondRef]);
}
