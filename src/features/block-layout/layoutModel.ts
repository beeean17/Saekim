import type { BlockKind, BlockLayout, LayoutAlign } from '../../types/metadata';
import {
  layoutIdentity,
  layoutIdentityForMatch,
  layoutIdentityMatchForElement,
  layoutWithIdentity,
  type LayoutIdentityMatch,
} from './layoutIdentity';
import { blockKindFromDataset, getLayoutWrappers, normalizedOccurrenceIndex } from './layoutDom';
import type { LayoutByKey, LayoutTarget } from './layoutTypes';

export const minImageResizePercent = 18;
export const maxImageResizePercent = 100;

export function findLayoutWrapperByIdentity(root: HTMLElement, identity: string): HTMLElement | null {
  if (!identity) return null;
  return getLayoutWrappers(root).find((wrapper) => layoutIdentitiesForWrapper(wrapper).includes(identity)) ?? null;
}

export function layoutIdentityForWrapper(wrapper: HTMLElement): string {
  return layoutIdentityForMatch(layoutMatchForWrapper(wrapper));
}

export function layoutIdentitiesForWrapper(wrapper: HTMLElement): string[] {
  return layoutIdentitiesForMatch(layoutMatchForWrapper(wrapper));
}

export function layoutIdentitiesForTarget(target: LayoutTarget): string[] {
  return layoutIdentitiesForMatch(layoutMatchForTarget(target));
}

export function uniqueLayouts(layouts: BlockLayout[]): BlockLayout[] {
  const byIdentity = new Map<string, BlockLayout>();
  layouts.forEach((layout) => {
    byIdentity.set(layoutIdentity(layout), layout);
  });
  return Array.from(byIdentity.values());
}

export function upsertBlockLayout(layouts: BlockLayout[], next: BlockLayout): BlockLayout[] {
  return [
    ...layouts.filter((layout) => layoutIdentity(layout) !== layoutIdentity(next)),
    next,
  ];
}

export function layoutForWrapper(
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
): BlockLayout {
  return layoutForMatch(layoutMatchForWrapper(wrapper), filePath, layoutByKey);
}

export function layoutForTarget(
  target: LayoutTarget,
  filePath: string,
  layoutByKey: LayoutByKey,
): BlockLayout {
  return layoutForMatch(layoutMatchForTarget(target), filePath, layoutByKey);
}

export function groupLayoutsForWrapper(
  root: HTMLElement,
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
): BlockLayout[] {
  const groupId = wrapper.dataset.groupId;
  if (!groupId) return [layoutForWrapper(wrapper, filePath, layoutByKey)];
  const layouts = getLayoutWrappers(root)
    .filter((item) => item.dataset.groupId === groupId)
    .map((item) => layoutForWrapper(item, filePath, layoutByKey));
  return layouts.length > 0 ? layouts : [layoutForWrapper(wrapper, filePath, layoutByKey)];
}

export function withColumnGroup(
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

export function withKatexEquationAlign(layout: BlockLayout, key: string, align: LayoutAlign): BlockLayout {
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

export function clearLayoutGroup(layout: BlockLayout): BlockLayout {
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

export function getLayoutGroupId(layout: BlockLayout): string | null {
  const value = layout.layoutJson?.groupId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function getLayoutGroupColumns(layout: BlockLayout): number {
  const value = layout.layoutJson?.groupColumns;
  return typeof value === 'number' && value > 1 ? value : 1;
}

export function getLayoutGroupIndex(layout: BlockLayout): number {
  const value = layout.layoutJson?.groupIndex;
  return typeof value === 'number' && value >= 0 ? value : 0;
}

export function isManualLayoutGroup(layout: BlockLayout): boolean {
  return layout.layoutJson?.groupMode === 'manual';
}

export function getKatexEquationAlignments(layout: BlockLayout): Record<string, LayoutAlign> {
  const value = layout.layoutJson?.equationAlignments;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value).reduce<Record<string, LayoutAlign>>((alignments, [key, align]) => {
    if (typeof key === 'string' && isLayoutAlignValue(align)) {
      alignments[key] = align;
    }
    return alignments;
  }, {});
}

export function layoutWidthCss(layout: BlockLayout): string {
  if (layout.widthUnit === 'auto' || layout.widthValue === null) return 'auto';
  if (layout.widthUnit === '%') return `${clamp(layout.widthValue, 10, 100)}%`;
  return `${Math.max(48, layout.widthValue)}px`;
}

export function resizeContainerWidth(wrapper: HTMLElement): number {
  const group = wrapper.closest<HTMLElement>('.preview-layout-group');
  if (group) return group.getBoundingClientRect().width / Math.max(1, Number.parseInt(group.dataset.columns ?? '1', 10));

  const parent = wrapper.parentElement;
  return parent?.getBoundingClientRect().width ?? wrapper.getBoundingClientRect().width;
}

export function widthPercentForLayout(layout: BlockLayout, fallbackWidth: number, containerWidth: number): number {
  if (layout.widthUnit === '%' && layout.widthValue !== null) {
    return clamp(layout.widthValue, minImageResizePercent, maxImageResizePercent);
  }

  if (layout.widthUnit === 'px' && layout.widthValue !== null && containerWidth > 0) {
    return clamp((layout.widthValue / containerWidth) * 100, minImageResizePercent, maxImageResizePercent);
  }

  return clamp((fallbackWidth / containerWidth) * 100, minImageResizePercent, maxImageResizePercent);
}

export function layoutPercentValue(layout: BlockLayout, fallback: number): number {
  return layout.widthUnit === '%' && layout.widthValue !== null
    ? clamp(layout.widthValue, minImageResizePercent, maxImageResizePercent)
    : fallback;
}

export function layoutGroupTemplate(widths: readonly number[]): string {
  return widths
    .map((width) => `minmax(0, ${formatLayoutNumber(Math.max(1, width))}fr)`)
    .join(' ');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundLayoutNumber(value: number): number {
  return Number(formatLayoutNumber(value));
}

export function formatLayoutNumber(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function layoutForMatch(match: LayoutIdentityMatch, filePath: string, layoutByKey: LayoutByKey): BlockLayout {
  const currentLayout = layoutByKey.get(layoutIdentity(match.current));
  if (currentLayout) return currentLayout;

  const legacyLayout = match.legacy ? layoutByKey.get(layoutIdentity(match.legacy)) : undefined;
  if (legacyLayout) return layoutWithIdentity(legacyLayout, match.current);

  return defaultBlockLayout(
    filePath,
    match.current.blockKind,
    match.current.blockKey,
    match.current.occurrenceIndex,
  );
}

function layoutIdentitiesForMatch(match: LayoutIdentityMatch): string[] {
  const current = layoutIdentity(match.current);
  const legacy = match.legacy ? layoutIdentity(match.legacy) : null;
  return legacy && legacy !== current ? [current, legacy] : [current];
}

function layoutMatchForWrapper(wrapper: HTMLElement): LayoutIdentityMatch {
  const blockKind = blockKindFromDataset(wrapper.dataset.blockKind) ?? 'image';
  const legacyBlockKey = wrapper.dataset.legacyBlockKey ?? wrapper.dataset.blockKey ?? 'block';
  const legacyOccurrenceIndex = normalizedOccurrenceIndex(
    wrapper.dataset.legacyOccurrenceIndex ?? wrapper.dataset.occurrenceIndex,
  );
  return layoutIdentityMatchForElement({
    element: wrapper,
    blockKind,
    legacyBlockKey,
    legacyOccurrenceIndex,
  });
}

function layoutMatchForTarget(target: LayoutTarget): LayoutIdentityMatch {
  return {
    current: {
      blockKind: target.blockKind,
      blockKey: target.blockKey,
      occurrenceIndex: target.occurrenceIndex,
    },
    legacy:
      target.legacyBlockKey !== null && target.legacyOccurrenceIndex !== null
        ? {
            blockKind: target.blockKind,
            blockKey: target.legacyBlockKey,
            occurrenceIndex: target.legacyOccurrenceIndex,
          }
        : null,
  };
}

function defaultBlockLayout(filePath: string, blockKind: BlockKind, blockKey: string, occurrenceIndex: number): BlockLayout {
  return {
    filePath,
    blockKind,
    blockKey,
    occurrenceIndex,
    widthValue: 100,
    widthUnit: '%',
    heightValue: null,
    heightUnit: 'auto',
    align: blockKind === 'text' || blockKind === 'list' || blockKind === 'blockquote' ? 'left' : 'center',
    layoutJson: null,
  };
}

function isLayoutAlignValue(value: unknown): value is LayoutAlign {
  return value === 'left' || value === 'center' || value === 'right';
}
