import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { SidebarMode, ViewMode } from '../types/workspace';

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_COLLAPSE_THRESHOLD = SIDEBAR_MIN_WIDTH / 2;
const DEFAULT_PANE_MIN_WIDTH = 280;
const MEDIUM_PANE_MIN_WIDTH = 240;

interface PaneResizerHandlers {
  readonly startSidebarResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly startPaneResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

interface UsePaneResizersArgs {
  readonly bodyRef: RefObject<HTMLElement>;
  readonly sidebarMode: SidebarMode;
  readonly sidebarWidth: number;
  readonly editorWidth: number;
  readonly effectiveViewMode: ViewMode;
  readonly viewportProfile: 'compact' | 'medium' | 'expanded';
  readonly setSidebarMode: (mode: SidebarMode) => void;
  readonly setSidebarWidth: (width: number) => void;
  readonly setEditorWidth: (width: number) => void;
  readonly setViewMode: (mode: ViewMode) => void;
}

export function usePaneResizers({
  bodyRef,
  sidebarMode,
  sidebarWidth,
  editorWidth,
  effectiveViewMode,
  viewportProfile,
  setSidebarMode,
  setSidebarWidth,
  setEditorWidth,
  setViewMode,
}: UsePaneResizersArgs): PaneResizerHandlers {
  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!body) return;
    event.preventDefault();
    const app = body.closest<HTMLElement>('.app');
    const rect = body.getBoundingClientRect();
    let nextWidth = sidebarMode === 'collapsed' ? SIDEBAR_MIN_WIDTH : sidebarWidth;
    let nextMode: SidebarMode = sidebarMode;
    let resizePreviewMode: SidebarMode | null = null;
    const updateResizePreviewMode = (mode: SidebarMode) => {
      if (mode === sidebarMode) {
        app?.removeAttribute('data-sidebar-resize-preview');
        resizePreviewMode = null;
        return;
      }
      if (resizePreviewMode === mode) return;
      resizePreviewMode = mode;
      app?.setAttribute('data-sidebar-resize-preview', mode);
    };
    const restoreSidebarWidth = () => {
      app?.style.setProperty('--sidebar-w', `${sidebarWidth}px`);
    };

    beginHorizontalDrag({
      element: event.currentTarget,
      pointerId: event.pointerId,
      onMove: (clientX) => {
        const rawWidth = clientX - rect.left;
        nextWidth = clamp(rawWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
        if (sidebarMode === 'collapsed') {
          nextMode = rawWidth >= SIDEBAR_COLLAPSE_THRESHOLD ? 'expanded' : 'collapsed';
        } else {
          nextMode = rawWidth < SIDEBAR_COLLAPSE_THRESHOLD ? 'collapsed' : 'expanded';
        }
        updateResizePreviewMode(nextMode);
        if (nextMode === 'expanded') {
          app?.style.setProperty('--sidebar-w', `${nextWidth}px`);
        } else {
          restoreSidebarWidth();
        }
      },
      onEnd: () => {
        if (nextMode === 'collapsed') {
          restoreSidebarWidth();
          setSidebarMode('collapsed');
        } else {
          setSidebarWidth(nextWidth);
          setSidebarMode('expanded');
        }
        app?.removeAttribute('data-sidebar-resize-preview');
      },
    });
  };

  const startPaneResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!body) return;
    event.preventDefault();
    const app = body.closest<HTMLElement>('.app');
    const editorPane = body.querySelector<HTMLElement>('.editor-pane');
    const previewPane = body.querySelector<HTMLElement>('.preview-pane');
    const editorRect = editorPane?.getBoundingClientRect();
    const previewRect = previewPane?.getBoundingClientRect();
    const editorLeft = editorRect?.left ?? 0;
    const previewRight = previewRect?.right ?? body.getBoundingClientRect().right;
    const splitHandleWidth = event.currentTarget.getBoundingClientRect().width || 6;
    const minPaneWidth = viewportProfile === 'medium' ? MEDIUM_PANE_MIN_WIDTH : DEFAULT_PANE_MIN_WIDTH;
    const availablePaneWidth = Math.max(minPaneWidth * 2, previewRight - editorLeft - splitHandleWidth);
    const maxEditorWidth = Math.max(minPaneWidth, availablePaneWidth - minPaneWidth);
    const modeSwitchThreshold = minPaneWidth / 2;
    let nextWidth = clamp(editorRect?.width ?? editorWidth, minPaneWidth, maxEditorWidth);
    let nextViewMode: ViewMode = effectiveViewMode;
    let resizePreviewMode: ViewMode | null = null;
    const updateResizePreviewMode = (mode: ViewMode) => {
      const visibleMode = viewportProfile === 'compact' && mode === 'split' ? 'edit' : mode;
      if (visibleMode === effectiveViewMode) {
        app?.removeAttribute('data-resize-preview');
        resizePreviewMode = null;
        return;
      }
      if (resizePreviewMode === visibleMode) return;
      resizePreviewMode = visibleMode;
      app?.setAttribute('data-resize-preview', visibleMode);
    };

    beginHorizontalDrag({
      element: event.currentTarget,
      pointerId: event.pointerId,
      onMove: (clientX) => {
        const rawWidth = clientX - editorLeft - splitHandleWidth / 2;
        const rawPreviewWidth = availablePaneWidth - rawWidth;
        nextViewMode =
          rawWidth < modeSwitchThreshold ? 'preview' : rawPreviewWidth < modeSwitchThreshold ? 'edit' : 'split';
        nextWidth = clamp(rawWidth, minPaneWidth, maxEditorWidth);
        updateResizePreviewMode(nextViewMode);
        app?.style.setProperty('--editor-w', `${nextWidth}px`);
        app?.style.setProperty('--effective-editor-w', `${nextWidth}px`);
      },
      onEnd: () => {
        setEditorWidth(nextViewMode === 'edit' ? maxEditorWidth : nextWidth);
        setViewMode(nextViewMode);
        app?.removeAttribute('data-resize-preview');
      },
    });
  };

  return { startSidebarResize, startPaneResize };
}

function beginHorizontalDrag({
  element,
  pointerId,
  onMove,
  onEnd,
}: {
  readonly element: HTMLElement;
  readonly pointerId: number;
  readonly onMove: (clientX: number) => void;
  readonly onEnd: () => void;
}): void {
  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  try {
    element.setPointerCapture(pointerId);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    onMove(event.clientX);
  };
  const stop = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
    try {
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }
    onEnd();
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', stop, { once: true });
  window.addEventListener('pointercancel', stop, { once: true });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
