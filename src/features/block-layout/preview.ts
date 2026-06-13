import type { PreviewContribution } from '../../app/feature';
import { Backend } from '../../platform/common/backend';
import type { BlockKind, BlockLayout, LayoutAlign } from '../../types/metadata';
import './blockLayout.css';

type BlockLayoutChange = BlockLayout | BlockLayout[];
type LayoutChangeHandler = (layout: BlockLayoutChange) => void;
type ActiveLayoutDrag = {
  filePath: string;
  identity: string;
  source: HTMLElement;
};

const blockLayoutCache = new Map<string, BlockLayout[]>();
let activeLayoutDrag: ActiveLayoutDrag | null = null;

export const blockLayoutPreviewEnhancement: PreviewContribution = {
  id: 'block-layout.preview-enhancement',
  priority: 30,
  match: ({ file, fileType }) => canUseBlockLayouts(file.path, fileType.previewKind === 'markdown'),
  async afterRender(root, { file }, signal) {
    const filePath = file.path;
    if (!canUseBlockLayouts(filePath, true)) return;

    let layouts = blockLayoutCache.get(filePath);
    if (!layouts) {
      try {
        layouts = await readBlockLayouts(filePath);
      } catch (error) {
        console.error('failed to load block layouts', error);
        layouts = [];
      }
      if (signal.aborted) return;
      blockLayoutCache.set(filePath, layouts);
    }

    const saveBlockLayout: LayoutChangeHandler = (layoutOrLayouts) => {
      const changes = Array.isArray(layoutOrLayouts) ? layoutOrLayouts : [layoutOrLayouts];
      const nextLayouts = changes.reduce(upsertBlockLayout, blockLayoutCache.get(filePath) ?? []);
      blockLayoutCache.set(filePath, nextLayouts);

      queueMicrotask(() => {
        if (root.isConnected) enhancePreviewLayoutBlocks(root, filePath, nextLayouts, saveBlockLayout);
      });

      void writeBlockLayouts(changes).catch((error) => {
        console.error('failed to save block layouts', error);
      });
    };

    enhancePreviewLayoutBlocks(root, filePath, layouts, saveBlockLayout);
  },
};

export function canUseBlockLayouts(filePath: string | null | undefined, supportsBlockLayouts: boolean | undefined): filePath is string {
  return Boolean(filePath && !filePath.startsWith('~') && !filePath.startsWith('browser://') && supportsBlockLayouts);
}

export async function readBlockLayouts(filePath: string): Promise<BlockLayout[]> {
  return Backend.metadata.loadBlockLayouts(filePath);
}

export async function writeBlockLayouts(layouts: BlockLayout[]): Promise<void> {
  await Promise.all(layouts.map((layout) => Backend.metadata.saveBlockLayout(layout)));
}

type LayoutTarget = {
  element: HTMLElement;
  blockKind: BlockKind;
  blockKey: string;
  occurrenceIndex: number;
};

const equationAligns: LayoutAlign[] = ['left', 'center', 'right'];
const minImageResizePercent = 18;
const maxImageResizePercent = 100;
const layoutDragThresholdPx = 4;
const layoutUngroupThresholdPx = 18;

export function enhancePreviewLayoutBlocks(
  root: HTMLElement,
  filePath: string,
  layouts: BlockLayout[],
  onChange: LayoutChangeHandler,
): void {
  if (filePath.startsWith('~') || filePath.startsWith('browser://')) return;

  unwrapLayoutGroups(root);
  unwrapUnsupportedLayoutWrappers(root);

  const layoutByKey = new Map(layouts.map((layout) => [layoutIdentity(layout), layout]));
  root.querySelectorAll<HTMLElement>('.preview-layout-block').forEach((wrapper) => {
    const blockKind = blockKindFromDataset(wrapper.dataset.blockKind);
    const blockKey = wrapper.dataset.blockKey;
    const occurrenceIndex = Number.parseInt(wrapper.dataset.occurrenceIndex ?? '', 10);
    if (!blockKind || !blockKey || !Number.isFinite(occurrenceIndex)) return;

    const identity = { blockKind, blockKey, occurrenceIndex };
    const layout =
      layoutByKey.get(layoutIdentity(identity)) ??
      defaultBlockLayout(filePath, blockKind, blockKey, occurrenceIndex);
    ensureLayoutSurface(wrapper);
    applyBlockLayout(wrapper, layout);
  });

  const targets = collectLayoutTargets(root);

  targets.forEach((target) => {
    const wrapper = ensureLayoutWrapper(target);
    const layout =
      layoutByKey.get(layoutIdentity(target)) ??
      defaultBlockLayout(filePath, target.blockKind, target.blockKey, target.occurrenceIndex);

    applyBlockLayout(wrapper, layout);
  });

  const normalizedLayouts = normalizeLayoutGroups(root, filePath, layoutByKey);
  normalizedLayouts.forEach((layout) => {
    layoutByKey.set(layoutIdentity(layout), layout);
  });

  getLayoutWrappers(root).forEach((wrapper) => {
    const layout = layoutForWrapper(wrapper, filePath, layoutByKey);
    applyBlockLayout(wrapper, layout);
    renderLayoutControls(wrapper, layout, root, filePath, layoutByKey, onChange);
    renderKatexEquationControls(wrapper, layout, root, onChange);
  });

  if (normalizedLayouts.length > 0) {
    onChange(normalizedLayouts);
  }

  arrangeLayoutGroups(root, filePath, layoutByKey);
}

export function reusePreviewLayoutBlocks(currentRoot: HTMLElement, nextRoot: ParentNode): void {
  const reusableBlocks = new Map<string, HTMLElement[]>();
  getLayoutWrappers(currentRoot).forEach((wrapper) => {
    const identity = layoutIdentityForWrapper(wrapper);
    const blocks = reusableBlocks.get(identity) ?? [];
    blocks.push(wrapper);
    reusableBlocks.set(identity, blocks);
  });

  if (reusableBlocks.size === 0) return;

  collectLayoutTargets(nextRoot).forEach((target) => {
    const identity = layoutIdentity(target);
    const reusableWrapper = reusableBlocks.get(identity)?.shift();
    if (!reusableWrapper) return;

    const parent = target.element.parentElement;
    const sourceElement =
      target.blockKind === 'image' && parent?.tagName === 'P' && isSingleImageParagraph(parent)
        ? parent
        : target.element;
    const surface = ensureLayoutSurface(reusableWrapper);

    reusableWrapper.dataset.blockKind = target.blockKind;
    reusableWrapper.dataset.blockKey = target.blockKey;
    reusableWrapper.dataset.occurrenceIndex = String(target.occurrenceIndex);
    copySourceLineDataset(sourceElement, reusableWrapper);
    replaceLayoutSurfaceContent(surface, target.element, target.blockKind);
    sourceElement.replaceWith(reusableWrapper);
  });
}

function replaceLayoutSurfaceContent(surface: HTMLElement, source: HTMLElement, blockKind: BlockKind): void {
  const reusableContent = reusableSurfaceContent(surface, source, blockKind);
  if (!reusableContent) {
    surface.replaceChildren(source);
    return;
  }

  syncElementAttributes(reusableContent, source);
  reusableContent.replaceChildren(...Array.from(source.childNodes));
}

function reusableSurfaceContent(surface: HTMLElement, source: HTMLElement, blockKind: BlockKind): HTMLElement | null {
  const current = surface.firstElementChild;
  if (!(current instanceof HTMLElement)) return null;

  if (blockKind === 'code') {
    return current.tagName === 'PRE' && source.tagName === 'PRE' ? current : null;
  }

  if (blockKind === 'table') {
    return current.tagName === 'TABLE' && source.tagName === 'TABLE' ? current : null;
  }

  if (blockKind === 'mermaid') {
    return current.classList.contains('mermaid-block') && source.classList.contains('mermaid-block') ? current : null;
  }

  if (blockKind === 'katex') {
    return current.classList.contains('math-block') && source.classList.contains('math-block') ? current : null;
  }

  return null;
}

function syncElementAttributes(target: HTMLElement, source: HTMLElement): void {
  Array.from(target.attributes).forEach((attribute) => {
    if (!source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
  });
  Array.from(source.attributes).forEach((attribute) => {
    target.setAttribute(attribute.name, attribute.value);
  });
}

function collectLayoutTargets(root: ParentNode): LayoutTarget[] {
  const targets: LayoutTarget[] = [];
  const imageCounts = new Map<string, number>();
  const genericCounts = new Map<string, number>();

  root.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    if (image.closest('.preview-layout-block, .pending-image-block, .failed-image-block')) return;

    const blockKey = image.getAttribute('data-original-src') || image.getAttribute('src') || image.alt || 'image';
    const occurrenceIndex = nextOccurrence(imageCounts, blockKey);
    targets.push({ element: image, blockKind: 'image', blockKey, occurrenceIndex });
  });

  root
    .querySelectorAll<HTMLElement>('table, pre, .mermaid-block, .math-block')
    .forEach((element) => {
      if (element.closest('.preview-layout-block')) return;
      if (element.classList.contains('mermaid-block') && !element.querySelector('svg')) return;

      const blockKind = blockKindForElement(element);
      if (!blockKind) return;
      const blockKey = stableBlockKey(element, blockKind);
      const occurrenceIndex = nextOccurrence(genericCounts, `${blockKind}:${blockKey}`);
      targets.push({ element, blockKind, blockKey, occurrenceIndex });
    });

  return targets;
}

function ensureLayoutWrapper(target: LayoutTarget): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `preview-layout-block preview-${target.blockKind}-layout`;
  wrapper.dataset.blockKind = target.blockKind;
  wrapper.dataset.blockKey = target.blockKey;
  wrapper.dataset.occurrenceIndex = String(target.occurrenceIndex);

  const parent = target.element.parentElement;
  const sourceElement = target.blockKind === 'image' && parent?.tagName === 'P' ? parent : target.element;
  copySourceLineDataset(sourceElement, wrapper);

  if (target.blockKind === 'image' && parent?.tagName === 'P' && isSingleImageParagraph(parent)) {
    parent.replaceWith(wrapper);
  } else {
    target.element.replaceWith(wrapper);
  }

  const surface = document.createElement('div');
  surface.className = 'preview-layout-surface';
  surface.append(target.element);
  wrapper.append(surface);
  return wrapper;
}

function ensureLayoutSurface(wrapper: HTMLElement): HTMLElement {
  const existing = wrapper.querySelector<HTMLElement>(':scope > .preview-layout-surface');
  if (existing) return existing;

  const surface = document.createElement('div');
  surface.className = 'preview-layout-surface';
  Array.from(wrapper.childNodes).forEach((node) => {
    if (isLayoutChromeNode(node)) return;
    surface.append(node);
  });
  wrapper.prepend(surface);
  return surface;
}

function renderLayoutControls(
  wrapper: HTMLElement,
  layout: BlockLayout,
  root: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
  onChange: LayoutChangeHandler,
): void {
  wrapper.querySelector('.preview-layout-tools')?.remove();
  wrapper.querySelector('.preview-layout-drop-zone')?.remove();
  wrapper.querySelectorAll('.preview-image-resize-handle').forEach((node) => node.remove());

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
    startLayoutPointerDrag(event, dragHandle, wrapper, root, filePath, layoutByKey, onChange);
  });
  tools.append(dragHandle);

  wrapper.append(tools);

  const dropZone = document.createElement('div');
  dropZone.className = 'preview-layout-drop-zone';
  dropZone.setAttribute('aria-hidden', 'true');
  wrapper.append(dropZone);

  renderImageResizeHandles(wrapper, root, filePath, layoutByKey, onChange);
}

function renderKatexEquationControls(
  wrapper: HTMLElement,
  layout: BlockLayout,
  root: HTMLElement,
  onChange: LayoutChangeHandler,
): void {
  if (blockKindFromDataset(wrapper.dataset.blockKind) !== 'katex') return;

  const equations = Array.from(wrapper.querySelectorAll<HTMLElement>('.math-equation'));
  if (equations.length === 0) return;

  const alignments = getKatexEquationAlignments(layout);

  equations.forEach((equation, index) => {
    const key = equation.dataset.equationKey || String(index);
    const currentAlign = alignments[key] ?? 'center';
    equation.dataset.align = currentAlign;
    equation.querySelector('.math-equation-tools')?.remove();

    if (!equation.dataset.equationSelectionBound) {
      equation.dataset.equationSelectionBound = 'true';
      equation.addEventListener('click', (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('.math-equation-tools')) return;

        clearSelectedKatexEquations(root);
        equation.dataset.selected = 'true';
      });
    }

    const tools = document.createElement('div');
    tools.className = 'math-equation-tools';
    tools.setAttribute('aria-label', '수식 정렬');
    tools.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    equationAligns.forEach((align) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = align === 'left' ? 'L' : align === 'center' ? 'C' : 'R';
      button.title = align === 'left' ? '수식 왼쪽 정렬' : align === 'center' ? '수식 가운데 정렬' : '수식 오른쪽 정렬';
      button.className = currentAlign === align ? 'active' : '';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearSelectedLayoutBlocks(root);
        clearSelectedKatexEquations(root);
        wrapper.dataset.selected = 'true';
        equation.dataset.selected = 'true';
        equation.dataset.align = align;
        onChange(withKatexEquationAlign(layout, key, align));
      });
      tools.append(button);
    });

    equation.append(tools);
  });
}

function bindLayoutSelection(root: HTMLElement, wrapper: HTMLElement): void {
  if (!root.dataset.layoutSelectionBound) {
    root.dataset.layoutSelectionBound = 'true';
    root.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.preview-layout-block')) return;
      clearSelectedLayoutBlocks(root);
      clearSelectedKatexEquations(root);
    });
  }

  if (wrapper.dataset.layoutSelectionBound) return;
  wrapper.dataset.layoutSelectionBound = 'true';
  wrapper.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('.preview-layout-tools')) return;
    if (!(target instanceof Element) || !isLayoutSelectionTarget(wrapper, target)) {
      clearSelectedLayoutBlocks(root);
      clearSelectedKatexEquations(root);
      return;
    }

    clearSelectedLayoutBlocks(root);
    wrapper.dataset.selected = 'true';
    if (!target.closest('.math-equation')) {
      clearSelectedKatexEquations(root);
    }
  });
}

function isLayoutSelectionTarget(wrapper: HTMLElement, target: Element): boolean {
  const surface = wrapper.querySelector<HTMLElement>(':scope > .preview-layout-surface');
  if (!surface || !surface.contains(target)) return false;

  const blockKind = blockKindFromDataset(wrapper.dataset.blockKind);
  const selectorByKind: Record<BlockKind, string> = {
    image: 'img',
    table: 'table',
    list: '',
    blockquote: '',
    code: 'pre, .shiki, code',
    mermaid: '.mermaid-block',
    katex: '.math-block',
  };
  const selector = blockKind ? selectorByKind[blockKind] : null;
  if (!selector) return false;

  const selected = target.closest<HTMLElement>(selector);
  return Boolean(selected && surface.contains(selected));
}

function clearSelectedLayoutBlocks(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.preview-layout-block[data-selected="true"]').forEach((item) => {
    delete item.dataset.selected;
  });
}

function clearSelectedKatexEquations(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.math-equation[data-selected="true"]').forEach((item) => {
    delete item.dataset.selected;
  });
}

function startLayoutPointerDrag(
  event: PointerEvent,
  handle: HTMLElement,
  wrapper: HTMLElement,
  root: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
  onChange: LayoutChangeHandler,
): void {
  if (event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();

  const identity = layoutIdentityForWrapper(wrapper);
  activeLayoutDrag = { filePath, identity, source: wrapper };
  clearSelectedLayoutBlocks(root);
  clearSelectedKatexEquations(root);
  wrapper.dataset.selected = 'true';
  wrapper.dataset.dragging = 'true';

  const startX = event.clientX;
  const startY = event.clientY;
  let started = false;

  handle.setPointerCapture(event.pointerId);

  const handlePointerMove = (moveEvent: PointerEvent) => {
    moveEvent.preventDefault();

    const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
    if (!started && distance < layoutDragThresholdPx) return;

    started = true;
    root.dataset.layoutDragging = 'true';
    updateLayoutDropPreview(root, wrapper, moveEvent.clientX, moveEvent.clientY);
  };

  const finishPointerDrag = (finishEvent: PointerEvent) => {
    if (handle.hasPointerCapture(finishEvent.pointerId)) handle.releasePointerCapture(finishEvent.pointerId);
    handle.removeEventListener('pointermove', handlePointerMove);
    handle.removeEventListener('pointerup', finishPointerDrag);
    handle.removeEventListener('pointercancel', cancelPointerDrag);

    const distance = Math.hypot(finishEvent.clientX - startX, finishEvent.clientY - startY);
    const target = currentLayoutDropTarget(root) ?? layoutDropTargetFromPoint(root, wrapper, finishEvent.clientX, finishEvent.clientY);
    if (started && target && canDropLayoutBlock(root, target, filePath)) {
      createManualTwoColumnGroup(root, wrapper, target, filePath, layoutByKey, onChange);
    } else if (started && distance >= layoutUngroupThresholdPx) {
      clearLayoutGroupForWrapper(root, wrapper, filePath, layoutByKey, onChange);
    }

    finishLayoutDrag(root, wrapper);
  };

  const cancelPointerDrag = (cancelEvent: PointerEvent) => {
    if (handle.hasPointerCapture(cancelEvent.pointerId)) handle.releasePointerCapture(cancelEvent.pointerId);
    handle.removeEventListener('pointermove', handlePointerMove);
    handle.removeEventListener('pointerup', finishPointerDrag);
    handle.removeEventListener('pointercancel', cancelPointerDrag);
    finishLayoutDrag(root, wrapper);
  };

  handle.addEventListener('pointermove', handlePointerMove);
  handle.addEventListener('pointerup', finishPointerDrag);
  handle.addEventListener('pointercancel', cancelPointerDrag);
}

function updateLayoutDropPreview(root: HTMLElement, source: HTMLElement, clientX: number, clientY: number): void {
  const target = layoutDropTargetFromPoint(root, source, clientX, clientY);
  clearLayoutDropTargets(root, target ?? undefined);
  if (target) {
    setLayoutDropPreviewMetrics(source, target);
    target.dataset.dropPosition = 'right';
  }
}

function layoutDropTargetFromPoint(
  root: HTMLElement,
  source: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const candidates = getLayoutWrappers(root).filter((item) => item !== source);
  let best: { wrapper: HTMLElement; score: number } | null = null;

  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const zoneWidth = rightDropZoneWidth(rect);
    const withinX = clientX >= rect.right - zoneWidth && clientX <= rect.right + 36;
    const withinY = clientY >= rect.top - 12 && clientY <= rect.bottom + 12;
    if (!withinX || !withinY) continue;

    const verticalDistance =
      clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const score = Math.abs(rect.right - clientX) + verticalDistance * 2;
    if (!best || score < best.score) best = { wrapper: candidate, score };
  }

  return best?.wrapper ?? null;
}

function currentLayoutDropTarget(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('.preview-layout-block[data-drop-position="right"]');
}

function setLayoutDropPreviewMetrics(source: HTMLElement, target: HTMLElement): void {
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const height = Math.max(72, Math.min(420, sourceRect.height || targetRect.height));
  target.style.setProperty('--preview-drop-height', `${Math.round(height)}px`);
}

function finishLayoutDrag(root: HTMLElement, source: HTMLElement): void {
  activeLayoutDrag = null;
  delete root.dataset.layoutDragging;
  delete source.dataset.dragging;
  clearLayoutDropTargets(root);
}

function bindLayoutDropTarget(
  root: HTMLElement,
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
  onChange: LayoutChangeHandler,
): void {
  wrapper.ondragover = (event) => {
    if (!canDropLayoutBlock(root, wrapper, filePath)) {
      delete wrapper.dataset.dropPosition;
      return;
    }

    if (!isRightEdgeDrop(wrapper, event)) {
      delete wrapper.dataset.dropPosition;
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    clearLayoutDropTargets(root, wrapper);
    wrapper.dataset.dropPosition = 'right';
  };

  wrapper.ondragleave = (event) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && wrapper.contains(relatedTarget)) return;
    delete wrapper.dataset.dropPosition;
  };

  wrapper.ondrop = (event) => {
    if (!canDropLayoutBlock(root, wrapper, filePath)) {
      delete wrapper.dataset.dropPosition;
      return;
    }

    if (!isRightEdgeDrop(wrapper, event) && wrapper.dataset.dropPosition !== 'right') return;

    const source = findLayoutWrapperByIdentity(root, activeLayoutDrag?.identity ?? '');
    if (!source || source === wrapper) return;

    event.preventDefault();
    createManualTwoColumnGroup(root, source, wrapper, filePath, layoutByKey, onChange);
    activeLayoutDrag = null;
    delete root.dataset.layoutDragging;
    delete source.dataset.dragging;
    clearLayoutDropTargets(root);
  };
}

function canDropLayoutBlock(root: HTMLElement, target: HTMLElement, filePath: string): boolean {
  if (!activeLayoutDrag || activeLayoutDrag.filePath !== filePath) return false;
  const source = activeLayoutDrag.source.isConnected
    ? activeLayoutDrag.source
    : findLayoutWrapperByIdentity(root, activeLayoutDrag.identity);
  return Boolean(source && source !== target);
}

function isRightEdgeDrop(wrapper: HTMLElement, event: DragEvent): boolean {
  const rect = wrapper.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const zoneWidth = rightDropZoneWidth(rect);
  return event.clientX >= rect.right - zoneWidth && event.clientX <= rect.right + 24;
}

function rightDropZoneWidth(rect: DOMRect): number {
  return Math.min(180, Math.max(64, rect.width * 0.32));
}

function clearLayoutDropTargets(root: HTMLElement, except?: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.preview-layout-block[data-drop-position]').forEach((item) => {
    if (item !== except) {
      delete item.dataset.dropPosition;
      item.style.removeProperty('--preview-drop-height');
    }
  });
}

function createManualTwoColumnGroup(
  root: HTMLElement,
  source: HTMLElement,
  target: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
  onChange: LayoutChangeHandler,
): void {
  const sourceLayout = layoutForWrapper(source, filePath, layoutByKey);
  const targetLayout = layoutForWrapper(target, filePath, layoutByKey);
  const sourceIdentity = layoutIdentity(sourceLayout);
  const targetIdentity = layoutIdentity(targetLayout);
  if (sourceIdentity === targetIdentity) return;

  const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const previousLayouts = uniqueLayouts([
    ...groupLayoutsForWrapper(root, source, filePath, layoutByKey),
    ...groupLayoutsForWrapper(root, target, filePath, layoutByKey),
  ]);

  const clearedPreviousLayouts = previousLayouts
    .filter((item) => {
      const identity = layoutIdentity(item);
      return identity !== sourceIdentity && identity !== targetIdentity;
    })
    .map((item) => clearLayoutGroup({ ...item, widthValue: 100, widthUnit: '%' }));

  onChange([
    ...clearedPreviousLayouts,
    withColumnGroup(clearLayoutGroup(targetLayout), groupId, 2, 0, 'manual'),
    withColumnGroup(clearLayoutGroup(sourceLayout), groupId, 2, 1, 'manual'),
  ]);
}

function clearLayoutGroupForWrapper(
  root: HTMLElement,
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
  onChange: LayoutChangeHandler,
): void {
  const layout = layoutForWrapper(wrapper, filePath, layoutByKey);
  if (!getLayoutGroupId(layout) || getLayoutGroupColumns(layout) <= 1) return;

  onChange(
    groupLayoutsForWrapper(root, wrapper, filePath, layoutByKey).map((item) =>
      clearLayoutGroup({ ...item, widthValue: 100, widthUnit: '%' }),
    ),
  );
}

function renderImageResizeHandles(
  wrapper: HTMLElement,
  root: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
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
    handle.setAttribute('aria-label', side === 'left' ? '이미지 왼쪽 크기 조절' : '이미지 오른쪽 크기 조절');
    handle.title = '이미지 크기 조절';
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
  layoutByKey: Map<string, BlockLayout>,
  onChange: LayoutChangeHandler,
): void {
  if (event.button !== 0) return;

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

type ImageGroupResizeContext = {
  group: HTMLElement;
  currentIndex: number;
  pairLayout: BlockLayout;
};

function imageGroupResizeContext(
  root: HTMLElement,
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
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

function applyBlockLayout(wrapper: HTMLElement, layout: BlockLayout): void {
  const width = layoutWidthCss(layout);

  wrapper.style.setProperty('--block-layout-width', width);
  wrapper.dataset.align = layout.align;
  wrapper.dataset.widthUnit = layout.widthUnit;
  wrapper.dataset.widthValue = layout.widthValue === null ? 'auto' : String(layout.widthValue);
  wrapper.dataset.layoutIdentity = layoutIdentity(layout);
  wrapper.dataset.flow = getLayoutGroupColumns(layout) > 1 ? 'columns' : 'block';
  wrapper.dataset.groupColumns = String(getLayoutGroupColumns(layout));
  wrapper.dataset.groupIndex = String(getLayoutGroupIndex(layout));
  wrapper.style.setProperty('--preview-layout-column', String(getLayoutGroupIndex(layout) + 1));
  const groupId = getLayoutGroupId(layout);
  if (groupId) {
    wrapper.dataset.groupId = groupId;
    if (isManualLayoutGroup(layout)) {
      wrapper.dataset.groupMode = 'manual';
    } else {
      delete wrapper.dataset.groupMode;
    }
  } else {
    delete wrapper.dataset.groupId;
    delete wrapper.dataset.groupMode;
  }
}

function layoutWidthCss(layout: BlockLayout): string {
  if (layout.widthUnit === 'auto' || layout.widthValue === null) return 'auto';
  if (layout.widthUnit === '%') return `${clamp(layout.widthValue, 10, 100)}%`;
  return `${Math.max(48, layout.widthValue)}px`;
}

function resizeContainerWidth(wrapper: HTMLElement): number {
  const group = wrapper.closest<HTMLElement>('.preview-layout-group');
  if (group) return group.getBoundingClientRect().width / Math.max(1, Number.parseInt(group.dataset.columns ?? '1', 10));

  const parent = wrapper.parentElement;
  return parent?.getBoundingClientRect().width ?? wrapper.getBoundingClientRect().width;
}

function widthPercentForLayout(layout: BlockLayout, fallbackWidth: number, containerWidth: number): number {
  if (layout.widthUnit === '%' && layout.widthValue !== null) {
    return clamp(layout.widthValue, minImageResizePercent, maxImageResizePercent);
  }

  if (layout.widthUnit === 'px' && layout.widthValue !== null && containerWidth > 0) {
    return clamp((layout.widthValue / containerWidth) * 100, minImageResizePercent, maxImageResizePercent);
  }

  return clamp((fallbackWidth / containerWidth) * 100, minImageResizePercent, maxImageResizePercent);
}

function layoutPercentValue(layout: BlockLayout, fallback: number): number {
  return layout.widthUnit === '%' && layout.widthValue !== null
    ? clamp(layout.widthValue, minImageResizePercent, maxImageResizePercent)
    : fallback;
}

function layoutGroupTemplate(widths: number[]): string {
  return widths
    .map((width) => `minmax(0, ${formatLayoutNumber(Math.max(1, width))}fr)`)
    .join(' ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundLayoutNumber(value: number): number {
  return Number(formatLayoutNumber(value));
}

function formatLayoutNumber(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function findLayoutWrapperByIdentity(root: HTMLElement, identity: string): HTMLElement | null {
  if (!identity) return null;
  return getLayoutWrappers(root).find((wrapper) => layoutIdentityForWrapper(wrapper) === identity) ?? null;
}

function layoutIdentityForWrapper(wrapper: HTMLElement): string {
  const blockKind = blockKindFromDataset(wrapper.dataset.blockKind) ?? 'image';
  const blockKey = wrapper.dataset.blockKey ?? 'block';
  const occurrenceIndex = Number.parseInt(wrapper.dataset.occurrenceIndex ?? '0', 10);
  return layoutIdentity({ blockKind, blockKey, occurrenceIndex: Number.isFinite(occurrenceIndex) ? occurrenceIndex : 0 });
}

function uniqueLayouts(layouts: BlockLayout[]): BlockLayout[] {
  const byIdentity = new Map<string, BlockLayout>();
  layouts.forEach((layout) => {
    byIdentity.set(layoutIdentity(layout), layout);
  });
  return Array.from(byIdentity.values());
}

function defaultBlockLayout(
  filePath: string,
  blockKind: BlockKind,
  blockKey: string,
  occurrenceIndex: number,
): BlockLayout {
  return {
    filePath,
    blockKind,
    blockKey,
    occurrenceIndex,
    widthValue: 100,
    widthUnit: '%',
    heightValue: null,
    heightUnit: 'auto',
    align: blockKind === 'list' || blockKind === 'blockquote' ? 'left' : 'center',
    layoutJson: null,
  };
}

function upsertBlockLayout(layouts: BlockLayout[], next: BlockLayout): BlockLayout[] {
  return [
    ...layouts.filter((layout) => layoutIdentity(layout) !== layoutIdentity(next)),
    next,
  ];
}

function layoutForWrapper(
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
): BlockLayout {
  const blockKind = blockKindFromDataset(wrapper.dataset.blockKind) ?? 'image';
  const blockKey = wrapper.dataset.blockKey ?? 'block';
  const occurrenceIndex = Number.parseInt(wrapper.dataset.occurrenceIndex ?? '0', 10);
  const identity = { blockKind, blockKey, occurrenceIndex };
  return (
    layoutByKey.get(layoutIdentity(identity)) ??
    defaultBlockLayout(filePath, blockKind, blockKey, Number.isFinite(occurrenceIndex) ? occurrenceIndex : 0)
  );
}

function groupLayoutsForWrapper(
  root: HTMLElement,
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
): BlockLayout[] {
  const groupId = wrapper.dataset.groupId;
  if (!groupId) return [layoutForWrapper(wrapper, filePath, layoutByKey)];
  const layouts = getLayoutWrappers(root)
    .filter((item) => item.dataset.groupId === groupId)
    .map((item) => layoutForWrapper(item, filePath, layoutByKey));
  return layouts.length > 0 ? layouts : [layoutForWrapper(wrapper, filePath, layoutByKey)];
}

function normalizeLayoutGroups(
  root: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
): BlockLayout[] {
  const wrappers = getLayoutWrappers(root);
  const groups = new Map<string, HTMLElement[]>();

  wrappers.forEach((wrapper) => {
    const layout = layoutForWrapper(wrapper, filePath, layoutByKey);
    const groupId = getLayoutGroupId(layout);
    if (!groupId) return;
    const group = groups.get(groupId) ?? [];
    group.push(wrapper);
    groups.set(groupId, group);
  });

  const normalized: BlockLayout[] = [];

  groups.forEach((groupWrappers) => {
    const orderedWrappers = groupWrappers.sort((a, b) => getLayoutWrappers(root).indexOf(a) - getLayoutWrappers(root).indexOf(b));
    const isManualGroup = orderedWrappers.some((wrapper) => isManualLayoutGroup(layoutForWrapper(wrapper, filePath, layoutByKey)));
    const shouldClear = orderedWrappers.length <= 1 || (!isManualGroup && !wrappersAreContiguous(orderedWrappers));
    if (!shouldClear) return;

    orderedWrappers.forEach((wrapper) => {
      const layout = layoutForWrapper(wrapper, filePath, layoutByKey);
      const next = clearLayoutGroup({ ...layout, widthValue: 100, widthUnit: '%' });
      normalized.push(next);
      applyBlockLayout(wrapper, next);
    });
  });

  return normalized;
}

function getLayoutWrappers(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.preview-layout-block')).filter((wrapper) =>
    isLayoutControlBlockKind(blockKindFromDataset(wrapper.dataset.blockKind)),
  );
}

function wrappersAreContiguous(wrappers: HTMLElement[]): boolean {
  for (let index = 1; index < wrappers.length; index += 1) {
    if (!sourceLinesAreContiguous(wrappers[index - 1], wrappers[index])) return false;
  }
  return true;
}

function sourceLinesAreContiguous(previous: HTMLElement, next: HTMLElement): boolean {
  const previousEndLine = sourceEndLine(previous);
  const nextStartLine = sourceStartLine(next);
  return previousEndLine !== null && nextStartLine !== null && nextStartLine <= previousEndLine + 1;
}

function withColumnGroup(
  layout: BlockLayout,
  groupId: string,
  columns: number,
  index: number,
  mode?: 'manual',
): BlockLayout {
  const width = columns === 2 ? 50 : 33.3333;
  return {
    ...layout,
    widthValue: width,
    widthUnit: '%',
    align: 'left',
    layoutJson: {
      ...(layout.layoutJson ?? {}),
      groupId,
      groupColumns: columns,
      groupIndex: index,
      ...(mode ? { groupMode: mode } : {}),
    },
  };
}

function withKatexEquationAlign(layout: BlockLayout, key: string, align: LayoutAlign): BlockLayout {
  const layoutJson = { ...(layout.layoutJson ?? {}) };
  const alignments = getKatexEquationAlignments(layout);

  if (align === 'center') {
    delete alignments[key];
  } else {
    alignments[key] = align;
  }

  if (Object.keys(alignments).length > 0) {
    layoutJson.equationAlignments = alignments;
  } else {
    delete layoutJson.equationAlignments;
  }

  return {
    ...layout,
    layoutJson: Object.keys(layoutJson).length > 0 ? layoutJson : null,
  };
}

function clearLayoutGroup(layout: BlockLayout): BlockLayout {
  const rest = { ...(layout.layoutJson ?? {}) };
  delete rest.groupId;
  delete rest.groupColumns;
  delete rest.groupIndex;
  delete rest.groupMode;
  return {
    ...layout,
    layoutJson: Object.keys(rest).length > 0 ? rest : null,
  };
}

function getLayoutGroupId(layout: BlockLayout): string | null {
  const value = layout.layoutJson?.groupId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getLayoutGroupColumns(layout: BlockLayout): number {
  const value = layout.layoutJson?.groupColumns;
  return typeof value === 'number' && value > 1 ? value : 1;
}

function getLayoutGroupIndex(layout: BlockLayout): number {
  const value = layout.layoutJson?.groupIndex;
  return typeof value === 'number' && value >= 0 ? value : 0;
}

function isManualLayoutGroup(layout: BlockLayout): boolean {
  return layout.layoutJson?.groupMode === 'manual';
}

function getKatexEquationAlignments(layout: BlockLayout): Record<string, LayoutAlign> {
  const value = layout.layoutJson?.equationAlignments;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value).reduce<Record<string, LayoutAlign>>((alignments, [key, align]) => {
    if (typeof key === 'string' && isLayoutAlignValue(align)) {
      alignments[key] = align;
    }
    return alignments;
  }, {});
}

function isLayoutAlignValue(value: unknown): value is LayoutAlign {
  return value === 'left' || value === 'center' || value === 'right';
}

function unwrapLayoutGroups(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.preview-layout-group').forEach((group) => {
    const parent = group.parentElement;
    if (!parent) return;
    Array.from(group.children).forEach((child) => {
      parent.insertBefore(child, group);
    });
    group.remove();
  });
}

function unwrapUnsupportedLayoutWrappers(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.preview-layout-block').forEach((wrapper) => {
    if (isLayoutControlBlockKind(blockKindFromDataset(wrapper.dataset.blockKind))) return;

    const parent = wrapper.parentElement;
    if (!parent) return;

    const surface = wrapper.querySelector<HTMLElement>(':scope > .preview-layout-surface');
    const nodes = surface
      ? Array.from(surface.childNodes)
      : Array.from(wrapper.childNodes).filter(
          (node) => !isLayoutChromeNode(node),
        );

    nodes.forEach((node) => parent.insertBefore(node, wrapper));
    wrapper.remove();
  });
}

function arrangeLayoutGroups(
  root: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
): void {
  const wrappers = getLayoutWrappers(root);
  const arrangedGroupIds = new Set<string>();
  let index = 0;

  while (index < wrappers.length) {
    const wrapper = wrappers[index];
    const groupId = wrapper.dataset.groupId;
    const columns = Number.parseInt(wrapper.dataset.groupColumns ?? '1', 10);
    if (!groupId || columns <= 1 || arrangedGroupIds.has(groupId)) {
      index += 1;
      continue;
    }

    const groupWrappersInDom = wrappers.filter((item) => item.dataset.groupId === groupId);
    const groupWrappers = [...groupWrappersInDom]
      .sort((a, b) => Number.parseInt(a.dataset.groupIndex ?? '0', 10) - Number.parseInt(b.dataset.groupIndex ?? '0', 10));
    if (groupWrappers.length <= 1) {
      index += 1;
      continue;
    }

    const isManualGroup = groupWrappersInDom.some((item) => item.dataset.groupMode === 'manual');
    const anchor = isManualGroup
      ? groupWrappers.find((item) => Number.parseInt(item.dataset.groupIndex ?? '0', 10) === 0) ?? groupWrappers[0]
      : groupWrappersInDom[0];
    if (wrapper !== anchor) {
      index += 1;
      continue;
    }

    const group = document.createElement('div');
    group.className = 'preview-layout-group';
    group.dataset.columns = String(columns);
    group.style.setProperty('--preview-layout-columns', String(columns));
    group.style.setProperty(
      '--preview-layout-template',
      layoutGroupTemplate(groupWrappers.map((item) => layoutPercentValue(layoutForWrapper(item, filePath, layoutByKey), 100 / columns))),
    );
    wrapper.before(group);
    groupWrappers.forEach((item) => group.append(item));
    arrangedGroupIds.add(groupId);
    index += 1;
  }
}

function copySourceLineDataset(from: HTMLElement, to: HTMLElement): void {
  const startLine = from.getAttribute('data-source-line');
  const endLine = from.getAttribute('data-source-end-line') ?? startLine;
  if (startLine) to.dataset.sourceLine = startLine;
  if (endLine) to.dataset.sourceEndLine = endLine;
}

function sourceStartLine(element: HTMLElement): number | null {
  const value = element.dataset.sourceLine ?? element.getAttribute('data-source-line');
  const line = Number.parseInt(value ?? '', 10);
  return Number.isFinite(line) ? line : null;
}

function sourceEndLine(element: HTMLElement): number | null {
  const value = element.dataset.sourceEndLine ?? element.getAttribute('data-source-end-line') ?? element.dataset.sourceLine;
  const line = Number.parseInt(value ?? '', 10);
  return Number.isFinite(line) ? line : null;
}

function layoutIdentity(layout: Pick<BlockLayout, 'blockKind' | 'blockKey' | 'occurrenceIndex'>): string {
  return `${layout.blockKind}:${layout.blockKey}:${layout.occurrenceIndex}`;
}

function nextOccurrence(counts: Map<string, number>, key: string): number {
  const next = counts.get(key) ?? 0;
  counts.set(key, next + 1);
  return next;
}

function blockKindForElement(element: HTMLElement): BlockKind | null {
  if (element.classList.contains('mermaid-block')) return 'mermaid';
  if (element.classList.contains('math-block')) return 'katex';
  if (element.tagName === 'TABLE') return 'table';
  if (element.tagName === 'PRE') return 'code';
  return null;
}

function blockKindFromDataset(value?: string): BlockKind | null {
  if (
    value === 'image' ||
    value === 'table' ||
    value === 'list' ||
    value === 'blockquote' ||
    value === 'code' ||
    value === 'mermaid' ||
    value === 'katex'
  ) {
    return value;
  }
  return null;
}

function isLayoutControlBlockKind(value: BlockKind | null): boolean {
  return value === 'image' || value === 'table' || value === 'code' || value === 'mermaid' || value === 'katex';
}

function stableBlockKey(element: HTMLElement, kind: BlockKind): string {
  const sourceLine = element.getAttribute('data-source-line') ?? '0';
  const sourceEndLine = element.getAttribute('data-source-end-line') ?? sourceLine;
  if (kind === 'code' && sourceLine !== '0') {
    const language = element.getAttribute('data-lang') ?? element.getAttribute('data-label') ?? '';
    return `${kind}:${sourceLine}:${language}`;
  }
  const text = element.dataset.source ?? element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return `${kind}:${sourceLine}-${sourceEndLine}:${stableHash(text)}`;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isSingleImageParagraph(paragraph: HTMLElement): boolean {
  const children = Array.from(paragraph.childNodes);
  const imageCount = children.filter((node) => node instanceof HTMLImageElement).length;
  if (imageCount !== 1) return false;

  return children.every((node) => {
    if (node.nodeType === Node.TEXT_NODE) return !node.textContent?.trim();
    if (node instanceof HTMLBRElement) return true;
    return node instanceof HTMLImageElement;
  });
}

function isLayoutChromeNode(node: ChildNode): boolean {
  return (
    node instanceof HTMLElement &&
    (node.classList.contains('preview-layout-tools') ||
      node.classList.contains('preview-layout-drop-zone') ||
      node.classList.contains('preview-image-resize-handle'))
  );
}
