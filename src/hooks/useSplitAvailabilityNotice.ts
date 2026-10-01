import { useEffect, useRef } from 'react';
import { notify } from '../core/notifications';
import { translateCurrent } from '../i18n/current';
import type { ViewMode } from '../types/workspace';

/**
 * Split view disappears below a width threshold. Without a word from the app
 * the preview just vanishes mid-resize and the Split button leaves the
 * toolbar, which reads as a bug. Say it once per transition - not on every
 * resize frame, and not when the user chose edit-only themselves.
 */
export function useSplitAvailabilityNotice(
  viewMode: ViewMode,
  availableViewModes: readonly ViewMode[],
): void {
  const wasSuppressed = useRef(false);

  useEffect(() => {
    const suppressed = viewMode === 'split' && !availableViewModes.includes('split');
    if (suppressed && !wasSuppressed.current) {
      notify(translateCurrent('view.splitUnavailable'), { key: 'split-unavailable', tone: 'info' });
    }
    wasSuppressed.current = suppressed;
  }, [availableViewModes, viewMode]);
}
