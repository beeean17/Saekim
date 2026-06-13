import { RefObject, useEffect } from 'react';
import type { ViewportProfile } from './useViewportProfile';
import type { SidebarMode, ViewMode } from '../types/workspace';

const DEFAULT_PANE_MIN_WIDTH = 280;
const MEDIUM_PANE_MIN_WIDTH = 240;
const PANE_RESIZER_WIDTH = 6;
const SIDEBAR_COLLAPSED_WIDTH = 56;

export function useResponsiveSplitWidth(
  bodyRef: RefObject<HTMLElement>,
  viewMode: ViewMode,
  sidebarMode: SidebarMode,
  sidebarWidth: number,
  editorWidth: number,
  viewportProfile: ViewportProfile,
): void {
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || viewMode !== 'split') return;
    const app = body.closest<HTMLElement>('.app');
    if (!app) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const activeSidebarWidth = sidebarMode === 'collapsed' ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth;
      const sidebarResizerWidth = sidebarMode === 'collapsed' ? 0 : PANE_RESIZER_WIDTH;
      const paneMinWidth = viewportProfile === 'medium' ? MEDIUM_PANE_MIN_WIDTH : DEFAULT_PANE_MIN_WIDTH;
      const availableWidth = body.clientWidth - activeSidebarWidth - sidebarResizerWidth - PANE_RESIZER_WIDTH;
      const maxEditorWidth = Math.max(paneMinWidth, availableWidth - paneMinWidth);
      const nextEditorWidth = clamp(editorWidth, paneMinWidth, maxEditorWidth);
      app.style.setProperty('--effective-editor-w', `${nextEditorWidth}px`);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(body);
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      app.style.removeProperty('--effective-editor-w');
    };
  }, [bodyRef, editorWidth, sidebarMode, sidebarWidth, viewMode, viewportProfile]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
