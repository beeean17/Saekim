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

    let locked = false;
    const sync = (source: HTMLElement, target: HTMLElement) => {
      if (locked) return;
      const maxSource = source.scrollHeight - source.clientHeight;
      const maxTarget = target.scrollHeight - target.clientHeight;
      const ratio = maxSource > 0 ? source.scrollTop / maxSource : 0;
      locked = true;
      target.scrollTop = ratio * maxTarget;
      window.requestAnimationFrame(() => {
        locked = false;
      });
    };
    const syncFirst = () => sync(first, second);
    const syncSecond = () => sync(second, first);

    first.addEventListener('scroll', syncFirst, { passive: true });
    second.addEventListener('scroll', syncSecond, { passive: true });
    sync(first, second);

    return () => {
      first.removeEventListener('scroll', syncFirst);
      second.removeEventListener('scroll', syncSecond);
    };
  }, [enabled, firstRef, secondRef]);
}
