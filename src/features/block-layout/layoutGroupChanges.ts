import { layoutIdentity } from './layoutIdentity';
import {
  clearLayoutGroup,
  getLayoutGroupColumns,
  getLayoutGroupId,
  groupLayoutsForWrapper,
  layoutForWrapper,
  uniqueLayouts,
  withColumnGroup,
} from './layoutModel';
import type { LayoutByKey, LayoutChangeHandler } from './layoutTypes';

export function createManualTwoColumnGroup(
  root: HTMLElement,
  source: HTMLElement,
  target: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
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

export function clearLayoutGroupForWrapper(
  root: HTMLElement,
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: LayoutByKey,
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
