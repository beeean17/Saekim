import { RefObject, useEffect } from 'react';

export function useScrollSync(
  sourceRef: RefObject<HTMLElement>,
  targetRef: RefObject<HTMLElement>,
  enabled: boolean,
): void {
  useEffect(() => {
    const source = sourceRef.current;
    const target = targetRef.current;
    if (!source || !target || !enabled) return;

    const sync = () => {
      const maxSource = source.scrollHeight - source.clientHeight;
      const maxTarget = target.scrollHeight - target.clientHeight;
      const ratio = maxSource > 0 ? source.scrollTop / maxSource : 0;
      target.scrollTop = ratio * maxTarget;
    };

    source.addEventListener('scroll', sync, { passive: true });
    return () => source.removeEventListener('scroll', sync);
  }, [enabled, sourceRef, targetRef]);
}
