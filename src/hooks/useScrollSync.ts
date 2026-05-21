import { RefObject, useEffect } from 'react';

const bottomSyncThreshold = 48;

function isFocusedTextAreaAtDocumentEnd(element: HTMLElement): boolean {
  if (!(element instanceof HTMLTextAreaElement) || document.activeElement !== element) return false;

  const cursorEnd = Math.max(element.selectionStart, element.selectionEnd);
  const { value } = element;
  for (let index = cursorEnd; index < value.length; index += 1) {
    const char = value.charCodeAt(index);
    if (char !== 9 && char !== 10 && char !== 13 && char !== 32) return false;
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

    const flush = () => {
      frame = 0;
      if (!pending) return;
      const { source, target } = pending;
      pending = null;
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
      if (pinTargetToBottom(first, second)) return;
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
