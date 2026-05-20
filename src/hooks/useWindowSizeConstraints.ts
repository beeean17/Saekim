import { useEffect } from 'react';
import type { SidebarMode, ViewMode } from '../types/workspace';

const PANE_MIN_WIDTH = 280;
const PANE_RESIZER_WIDTH = 6;
const SIDEBAR_COLLAPSED_WIDTH = 56;
const MIN_WINDOW_HEIGHT = 640;

export function useWindowSizeConstraints(viewMode: ViewMode, sidebarMode: SidebarMode, sidebarWidth: number): void {
  useEffect(() => {
    const activeSidebarWidth = sidebarMode === 'collapsed' ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth;
    const sidebarResizerWidth = sidebarMode === 'collapsed' ? 0 : PANE_RESIZER_WIDTH;
    const contentWidth =
      viewMode === 'split' ? PANE_MIN_WIDTH * 2 + PANE_RESIZER_WIDTH : PANE_MIN_WIDTH;
    const minWidth = Math.round(activeSidebarWidth + sidebarResizerWidth + contentWidth);
    let cancelled = false;

    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow, LogicalSize }) => {
        if (!cancelled) {
          return getCurrentWindow().setMinSize(new LogicalSize(minWidth, MIN_WINDOW_HEIGHT));
        }
        return undefined;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [sidebarMode, sidebarWidth, viewMode]);
}
