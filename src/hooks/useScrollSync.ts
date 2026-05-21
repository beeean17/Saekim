import { RefObject, useEffect } from 'react';

const bottomSyncThreshold = 48;
const scrollIntentDuration = 250;
const whitespaceCharCodes = new Set([9, 10, 13, 32]);

type PendingSync = {
  forceBottom: boolean;
  source: HTMLElement;
  target: HTMLElement;
};

function getMaxScroll(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight);
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
    let pending: PendingSync | null = null;
    let firstUserScrollUntil = 0;
    let secondUserScrollUntil = 0;

    const markFirstUserScroll = () => {
      firstUserScrollUntil = performance.now() + scrollIntentDuration;
    };
    const markSecondUserScroll = () => {
      secondUserScrollUntil = performance.now() + scrollIntentDuration;
    };
    const markFirstKeyboardScroll = (event: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
      markFirstUserScroll();
    };
    const markFirstPointerScroll = (event: PointerEvent) => {
      if (event.offsetX < first.clientWidth && event.offsetY < first.clientHeight) return;
      markFirstUserScroll();
    };
    const isUserScroll = (element: HTMLElement) => {
      const now = performance.now();
      return element === first ? now <= firstUserScrollUntil : now <= secondUserScrollUntil;
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

    const applyScroll = (target: HTMLElement, nextScrollTop: number) => {
      if (Math.abs(target.scrollTop - nextScrollTop) < 0.5) return;
      target.scrollTop = nextScrollTop;
      releaseSuppression(target);
    };

    const syncByRatio = ({ forceBottom, source, target }: PendingSync) => {
      const maxSource = getMaxScroll(source);
      const maxTarget = getMaxScroll(target);
      if (maxTarget <= 0) return;

      const shouldPinBottom = forceBottom || isNearBottom(source);
      const ratio = maxSource <= 0 ? 0 : source.scrollTop / maxSource;
      applyScroll(target, shouldPinBottom ? maxTarget : ratio * maxTarget);
    };

    const flush = () => {
      frame = 0;
      if (!pending) return;
      const next = pending;
      pending = null;
      syncByRatio(next);
    };

    const sync = (source: HTMLElement, target: HTMLElement, forceBottom = false) => {
      if (source === suppressed) return;
      if (target === first && document.activeElement === first && !isUserScroll(source)) return;
      pending = { forceBottom, source, target };
      if (frame) return;
      frame = window.requestAnimationFrame(flush);
    };

    const shouldForceEditorBottom = () => isNearBottom(first) || isFocusedTextAreaAtDocumentEnd(first);
    const syncFirst = () => sync(first, second, shouldForceEditorBottom());
    const syncSecond = () => sync(second, first);
    const syncAfterPreviewRender = () => {
      if (document.activeElement === first || isNearBottom(first)) syncFirst();
    };

    const resizeObserver = new ResizeObserver(syncAfterPreviewRender);
    resizeObserver.observe(second);
    second.addEventListener('saekim-preview-rendered', syncAfterPreviewRender);

    first.addEventListener('wheel', markFirstUserScroll, { passive: true });
    first.addEventListener('touchmove', markFirstUserScroll, { passive: true });
    first.addEventListener('pointerdown', markFirstPointerScroll, { passive: true });
    first.addEventListener('keydown', markFirstKeyboardScroll);
    first.addEventListener('input', syncFirst);
    first.addEventListener('scroll', syncFirst, { passive: true });
    second.addEventListener('wheel', markSecondUserScroll, { passive: true });
    second.addEventListener('touchmove', markSecondUserScroll, { passive: true });
    second.addEventListener('pointerdown', markSecondUserScroll, { passive: true });
    second.addEventListener('keydown', markSecondUserScroll);
    second.addEventListener('scroll', syncSecond, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (releaseFrame) window.cancelAnimationFrame(releaseFrame);
      first.removeEventListener('wheel', markFirstUserScroll);
      first.removeEventListener('touchmove', markFirstUserScroll);
      first.removeEventListener('pointerdown', markFirstPointerScroll);
      first.removeEventListener('keydown', markFirstKeyboardScroll);
      first.removeEventListener('input', syncFirst);
      first.removeEventListener('scroll', syncFirst);
      second.removeEventListener('wheel', markSecondUserScroll);
      second.removeEventListener('touchmove', markSecondUserScroll);
      second.removeEventListener('pointerdown', markSecondUserScroll);
      second.removeEventListener('keydown', markSecondUserScroll);
      second.removeEventListener('scroll', syncSecond);
      resizeObserver.disconnect();
      second.removeEventListener('saekim-preview-rendered', syncAfterPreviewRender);
    };
  }, [enabled, firstRef, secondRef]);
}
