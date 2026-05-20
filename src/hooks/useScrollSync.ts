import { RefObject, useEffect } from 'react';

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

    const flush = () => {
      frame = 0;
      if (!pending) return;
      const { source, target } = pending;
      pending = null;
      const maxSource = source.scrollHeight - source.clientHeight;
      const maxTarget = target.scrollHeight - target.clientHeight;
      if (maxSource <= 0 || maxTarget <= 0) return;

      const ratio = source.scrollTop / maxSource;
      const nextScrollTop = ratio * maxTarget;
      if (Math.abs(target.scrollTop - nextScrollTop) < 0.5) return;

      suppressed = target;
      target.scrollTop = nextScrollTop;
      if (releaseFrame) window.cancelAnimationFrame(releaseFrame);
      releaseFrame = window.requestAnimationFrame(() => {
        releaseFrame = window.requestAnimationFrame(() => {
          releaseFrame = 0;
          suppressed = null;
        });
      });
    };

    const sync = (source: HTMLElement, target: HTMLElement) => {
      if (source === suppressed) return;
      pending = { source, target };
      if (frame) return;
      frame = window.requestAnimationFrame(flush);
    };
    const syncFirst = () => sync(first, second);
    const syncSecond = () => sync(second, first);

    first.addEventListener('scroll', syncFirst, { passive: true });
    second.addEventListener('scroll', syncSecond, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (releaseFrame) window.cancelAnimationFrame(releaseFrame);
      first.removeEventListener('scroll', syncFirst);
      second.removeEventListener('scroll', syncSecond);
    };
  }, [enabled, firstRef, secondRef]);
}
