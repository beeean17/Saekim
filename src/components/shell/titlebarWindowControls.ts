import type { MouseEvent } from 'react';
import { Backend } from '../../platform/common/backend';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';

const DRAG_START_DISTANCE_PX = 4;

export function handleTitlebarMouseDown(event: MouseEvent<HTMLElement>): void {
  if (event.button !== 0 || !currentPlatformCapabilities().has('window.chrome')) return;
  if (isInteractiveTitlebarTarget(event)) return;

  event.preventDefault();
  if (event.detail === 2) {
    toggleTitlebarMaximize();
    return;
  }
  if (event.detail > 2) return;

  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;

  const cleanup = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', cleanup);
  };

  const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
    if (dragging) return;
    const deltaX = Math.abs(moveEvent.clientX - startX);
    const deltaY = Math.abs(moveEvent.clientY - startY);
    if (deltaX < DRAG_START_DISTANCE_PX && deltaY < DRAG_START_DISTANCE_PX) return;

    dragging = true;
    cleanup();
    void Backend.runtime.startWindowDrag().catch((error) => {
      console.warn('Failed to start titlebar drag:', error);
    });
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', cleanup, { once: true });
}

function toggleTitlebarMaximize(): void {
  void Backend.runtime.runWindowAction('toggleMaximize').catch((error) => {
    console.warn('Failed to toggle titlebar maximize:', error);
  });
}

function isInteractiveTitlebarTarget(event: MouseEvent<HTMLElement>): boolean {
  return (
    event.target instanceof HTMLElement &&
    Boolean(event.target.closest('button, input, textarea, select, a, [role="button"]'))
  );
}
