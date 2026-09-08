import type { BlockLayout } from '../../types/metadata';
import { isPreviewArrangeMode } from './interactionMode';
import {
  clamp,
  formatLayoutNumber,
  getLayoutGroupColumns,
  getLayoutGroupId,
  getLayoutGroupIndex,
  groupLayoutsForWrapper,
  layoutForWrapper,
  layoutGroupTemplate,
  layoutPercentValue,
  maxImageResizePercent,
  minImageResizePercent,
  resizeContainerWidth,
  roundLayoutNumber,
  widthPercentForLayout,
} from './layoutModel';
import { clearSelectedLayoutBlocks } from './layoutSelection';
import { blockKindFromDataset } from './layoutDom';
import type { LayoutByKey, LayoutChangeHandler } from './layoutTypes';
import { translateCurrent } from '../../i18n/current';

type ImageGroupResizeContext = {
  readonly group: HTMLElement;
  readonly currentIndex: number;
  readonly pairLayout: BlockLayout;
};

export function renderImageResizeHandles(
  wrapper: HTMLElement,
  root: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
  onChange: LayoutChangeHandler,
): void {
  if (blockKindFromDataset(wrapper.dataset.blockKind) !== 'image') return;

  const image = wrapper.querySelector<HTMLImageElement>(':scope > .preview-layout-surface > img');
  if (!image) return;
  image.draggable = false;

  (['left', 'right'] as const).forEach((side) => {
    const handle = document.createElement('div');
    handle.className = `preview-image-resize-handle ${side}`;
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', translateCurrent(side === 'left' ? 'layout.imageResizeLeft' : 'layout.imageResizeRight'));
    handle.title = translateCurrent('layout.imageResize');
    handle.addEventListener('pointerdown', (event) => {
      startImageResize(event, side, wrapper, root, filePath, layoutByKey, onChange);
    });
    wrapper.append(handle);
  });
}

function startImageResize(
  event: PointerEvent,
  side: 'left' | 'right',
  wrapper: HTMLElement,
  root: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
  onChange: LayoutChangeHandler,
): void {
  if (event.button !== 0 || !isPreviewArrangeMode(root)) return;

  const groupResize = imageGroupResizeContext(root, wrapper, filePath, layoutByKey);
  const containerWidth = groupResize?.group.getBoundingClientRect().width ?? resizeContainerWidth(wrapper);
  if (containerWidth <= 0) return;

  event.preventDefault();
  event.stopPropagation();
  clearSelectedLayoutBlocks(root);
  wrapper.dataset.selected = 'true';
  wrapper.dataset.resizing = side;

  const initialWidth = wrapper.getBoundingClientRect().width;
  const startX = event.clientX;
  const initialLayout = layoutForWrapper(wrapper, filePath, layoutByKey);
  const initialPercent = groupResize
    ? layoutPercentValue(initialLayout, 50)
    : widthPercentForLayout(initialLayout, initialWidth, containerWidth);
  let nextPercent = initialPercent;

  const handlePointerMove = (moveEvent: PointerEvent) => {
    moveEvent.preventDefault();
    const delta = moveEvent.clientX - startX;

    if (groupResize) {
      const deltaPercent = (delta / containerWidth) * 100;
      nextPercent = clamp(
        side === 'right' ? initialPercent + deltaPercent : initialPercent - deltaPercent,
        minImageResizePercent,
        100 - minImageResizePercent,
      );
      applyTwoColumnResizePreview(groupResize.group, groupResize.currentIndex, nextPercent);
    } else {
      const nextWidth = side === 'right' ? initialWidth + delta : initialWidth - delta;
      nextPercent = clamp((nextWidth / containerWidth) * 100, minImageResizePercent, maxImageResizePercent);
      wrapper.style.setProperty('--block-layout-width', `${nextPercent}%`);
    }

    wrapper.dataset.widthUnit = '%';
    wrapper.dataset.widthValue = formatLayoutNumber(nextPercent);
  };

  const handlePointerUp = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    delete wrapper.dataset.resizing;

    const currentLayout = layoutForWrapper(wrapper, filePath, layoutByKey);
    if (groupResize) {
      const roundedCurrent = roundLayoutNumber(nextPercent);
      const roundedPair = roundLayoutNumber(100 - nextPercent);
      const current = {
        ...currentLayout,
        widthValue: roundedCurrent,
        widthUnit: '%' as const,
        heightValue: null,
        heightUnit: 'auto' as const,
      };
      const pair = {
        ...groupResize.pairLayout,
        widthValue: roundedPair,
        widthUnit: '%' as const,
        heightValue: null,
        heightUnit: 'auto' as const,
      };
      onChange([current, pair]);
      return;
    }

    onChange({
      ...currentLayout,
      widthValue: roundLayoutNumber(nextPercent),
      widthUnit: '%',
      heightValue: null,
      heightUnit: 'auto',
    });
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);
}

function imageGroupResizeContext(
  root: HTMLElement,
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
): ImageGroupResizeContext | null {
  const group = wrapper.closest<HTMLElement>('.preview-layout-group');
  if (!group) return null;

  const currentLayout = layoutForWrapper(wrapper, filePath, layoutByKey);
  if (getLayoutGroupColumns(currentLayout) !== 2) return null;

  const groupLayouts = groupLayoutsForWrapper(root, wrapper, filePath, layoutByKey)
    .filter((layout) => getLayoutGroupId(layout) === getLayoutGroupId(currentLayout))
    .sort((a, b) => getLayoutGroupIndex(a) - getLayoutGroupIndex(b));
  if (groupLayouts.length !== 2) return null;

  const currentIndex = getLayoutGroupIndex(currentLayout);
  const pairLayout = groupLayouts.find((layout) => getLayoutGroupIndex(layout) !== currentIndex);
  if (!pairLayout) return null;

  return { group, currentIndex, pairLayout };
}

function applyTwoColumnResizePreview(group: HTMLElement, currentIndex: number, currentPercent: number): void {
  const pairPercent = 100 - currentPercent;
  const widths = currentIndex === 0 ? [currentPercent, pairPercent] : [pairPercent, currentPercent];
  group.style.setProperty('--preview-layout-template', layoutGroupTemplate(widths));
}
