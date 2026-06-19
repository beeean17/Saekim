import type { BlockLayout } from '../../types/metadata';
import { isLayoutInteractionChromeNode } from './interactionMode';
import { layoutIdentity } from './layoutIdentity';
import {
  clearLayoutGroup,
  getLayoutGroupColumns,
  getLayoutGroupId,
  getLayoutGroupIndex,
  isManualLayoutGroup,
  layoutForWrapper,
  layoutGroupTemplate,
  layoutPercentValue,
  layoutWidthCss,
} from './layoutModel';
import { getLayoutWrappers, isLayoutControlBlockKind, blockKindFromDataset, sourceEndLine, sourceStartLine } from './layoutDom';
import type { LayoutByKey } from './layoutTypes';

export function applyBlockLayout(wrapper: HTMLElement, layout: BlockLayout): void {
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

export function normalizeLayoutGroups(
  root: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
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

export function arrangeLayoutGroups(
  root: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
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

export function unwrapLayoutGroups(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.preview-layout-group').forEach((group) => {
    const parent = group.parentElement;
    if (!parent) return;
    Array.from(group.children).forEach((child) => {
      parent.insertBefore(child, group);
    });
    group.remove();
  });
}

export function unwrapUnsupportedLayoutWrappers(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.preview-layout-block').forEach((wrapper) => {
    if (isLayoutControlBlockKind(blockKindFromDataset(wrapper.dataset.blockKind))) return;

    const parent = wrapper.parentElement;
    if (!parent) return;

    const surface = wrapper.querySelector<HTMLElement>(':scope > .preview-layout-surface');
    const nodes = surface
      ? Array.from(surface.childNodes)
      : Array.from(wrapper.childNodes).filter((node) => !isLayoutInteractionChromeNode(node));

    nodes.forEach((node) => parent.insertBefore(node, wrapper));
    wrapper.remove();
  });
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
