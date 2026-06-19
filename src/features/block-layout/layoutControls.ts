import type { BlockLayout } from '../../types/metadata';
import { removeLayoutInteractionChrome } from './interactionMode';
import { renderImageResizeHandles } from './imageResize';
import { bindLayoutDropTarget, startLayoutPointerDrag } from './layoutBlockDrag';
import type { LayoutInteractionPolicy } from './layoutInteractionPolicy';
import { getLayoutGroupId } from './layoutModel';
import { bindLayoutSelection } from './layoutSelection';
import type { LayoutByKey, LayoutChangeHandler } from './layoutTypes';

export function renderLayoutControls(
  wrapper: HTMLElement,
  layout: BlockLayout,
  root: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
  onChange: LayoutChangeHandler,
  interactionPolicy: LayoutInteractionPolicy,
): void {
  removeLayoutInteractionChrome(wrapper);

  const tools = document.createElement('div');
  tools.className = 'preview-layout-tools';
  tools.setAttribute('aria-label', '블록 레이아웃');
  tools.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  bindLayoutSelection(root, wrapper);
  bindLayoutDropTarget(root, wrapper, filePath, layoutByKey, onChange);

  const dragHandle = document.createElement('div');
  dragHandle.className = 'preview-layout-drag-handle';
  dragHandle.draggable = false;
  dragHandle.tabIndex = 0;
  dragHandle.setAttribute('role', 'button');
  dragHandle.setAttribute('aria-label', '블록 배치 이동');
  dragHandle.title = getLayoutGroupId(layout) ? '드래그해서 1열로 풀거나 다른 블록 오른쪽에 배치' : '오른쪽 끝으로 드래그해서 2열 배치';
  dragHandle.addEventListener('pointerdown', (event) => {
    startLayoutPointerDrag(event, dragHandle, wrapper, root, filePath, layoutByKey, onChange, interactionPolicy);
  });
  tools.append(dragHandle);

  wrapper.append(tools);

  const dropZone = document.createElement('div');
  dropZone.className = 'preview-layout-drop-zone';
  dropZone.setAttribute('aria-hidden', 'true');
  wrapper.append(dropZone);

  renderImageResizeHandles(wrapper, root, filePath, layoutByKey, onChange);
}
