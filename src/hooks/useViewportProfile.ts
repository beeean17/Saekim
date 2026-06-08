import { useEffect, useState } from 'react';

export type ViewportProfile = 'compact' | 'medium' | 'expanded';

export interface ViewportProfileSnapshot {
  profile: ViewportProfile;
  width: number;
}

const COMPACT_MAX_WIDTH = 599;
const MEDIUM_MAX_WIDTH = 839;

export function viewportProfileForWidth(width: number): ViewportProfile {
  if (width <= COMPACT_MAX_WIDTH) return 'compact';
  if (width <= MEDIUM_MAX_WIDTH) return 'medium';
  return 'expanded';
}

export function getViewportProfileSnapshot(): ViewportProfileSnapshot {
  if (typeof window === 'undefined') return { profile: 'expanded', width: 0 };

  const width = Math.round(window.visualViewport?.width ?? window.innerWidth);
  return {
    profile: viewportProfileForWidth(width),
    width,
  };
}

export function useViewportProfile(): ViewportProfileSnapshot {
  const [snapshot, setSnapshot] = useState(getViewportProfileSnapshot);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setSnapshot(getViewportProfileSnapshot());
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener('resize', scheduleUpdate);
    window.visualViewport?.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  return snapshot;
}
