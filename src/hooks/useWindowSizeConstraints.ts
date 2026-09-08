import { useEffect } from 'react';
import { Backend } from '../platform/common/backend';
import { currentPlatformCapabilities } from '../platform/common/capabilities';

const MIN_WINDOW_WIDTH = 622;
const MIN_WINDOW_HEIGHT = 640;

export function useWindowSizeConstraints(): void {
  useEffect(() => {
    if (!currentPlatformCapabilities().has('window.chrome')) return;

    let cancelled = false;

    const frameId = window.requestAnimationFrame(() => {
      if (!cancelled) {
        void Backend.runtime.setWindowMinSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT).catch(
          () => undefined,
        );
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, []);
}
