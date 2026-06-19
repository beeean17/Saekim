import type { PreviewContribution } from '../../app/feature';
import { Backend } from '../../platform/common/backend';
import type { BlockLayout } from '../../types/metadata';
import { clearLayoutInteractionState, isPreviewArrangeMode, removeLayoutInteractionChrome } from './interactionMode';
import {
  applyBlockLayout,
  arrangeLayoutGroups,
  normalizeLayoutGroups,
  unwrapLayoutGroups,
  unwrapUnsupportedLayoutWrappers,
} from './layoutArrangement';
import { clearActiveLayoutDrag } from './layoutBlockDrag';
import { renderLayoutControls } from './layoutControls';
import { blockKindFromDataset, copySourceLineDataset, getLayoutWrappers, isSingleImageParagraph } from './layoutDom';
import { layoutIdentity } from './layoutIdentity';
import { layoutInteractionPolicyFromRoot } from './layoutInteractionPolicy';
import {
  layoutForTarget,
  layoutForWrapper,
  layoutIdentitiesForTarget,
  layoutIdentitiesForWrapper,
  upsertBlockLayout,
} from './layoutModel';
import {
  applyLayoutTargetDataset,
  collectLayoutTargets,
  ensureLayoutSurface,
  ensureLayoutWrapper,
  replaceLayoutSurfaceContent,
} from './layoutTargets';
import { renderKatexEquationControls } from './katexControls';
import type { LayoutChangeHandler } from './layoutTypes';
import './blockLayout.css';
import './layoutDropPreview.css';

const blockLayoutCache = new Map<string, BlockLayout[]>();

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
  return Boolean(filePath && !filePath.startsWith('~') && supportsBlockLayouts);
}

export async function readBlockLayouts(filePath: string): Promise<BlockLayout[]> {
  return Backend.metadata.loadBlockLayouts(filePath);
}

export async function writeBlockLayouts(layouts: BlockLayout[]): Promise<void> {
  await Promise.all(layouts.map((layout) => Backend.metadata.saveBlockLayout(layout)));
}

export function enhancePreviewLayoutBlocks(
  root: HTMLElement,
  filePath: string,
  layouts: BlockLayout[],
  onChange: LayoutChangeHandler,
): void {
  if (filePath.startsWith('~')) return;
  const isArrangeMode = isPreviewArrangeMode(root);
  const interactionPolicy = layoutInteractionPolicyFromRoot(root);

  unwrapLayoutGroups(root);
  unwrapUnsupportedLayoutWrappers(root);

  const layoutByKey = new Map(layouts.map((layout) => [layoutIdentity(layout), layout]));
  root.querySelectorAll<HTMLElement>('.preview-layout-block').forEach((wrapper) => {
    const blockKind = blockKindFromDataset(wrapper.dataset.blockKind);
    if (!blockKind) return;

    const layout = layoutForWrapper(wrapper, filePath, layoutByKey);
    ensureLayoutSurface(wrapper);
    applyBlockLayout(wrapper, layout);
  });

  const targets = collectLayoutTargets(root);

  targets.forEach((target) => {
    const wrapper = ensureLayoutWrapper(target);
    const layout = layoutForTarget(target, filePath, layoutByKey);

    applyBlockLayout(wrapper, layout);
  });

  const normalizedLayouts = normalizeLayoutGroups(root, filePath, layoutByKey);
  normalizedLayouts.forEach((layout) => {
    layoutByKey.set(layoutIdentity(layout), layout);
  });

  getLayoutWrappers(root).forEach((wrapper) => {
    const layout = layoutForWrapper(wrapper, filePath, layoutByKey);
    applyBlockLayout(wrapper, layout);
    if (isArrangeMode) {
      renderLayoutControls(wrapper, layout, root, filePath, layoutByKey, onChange, interactionPolicy);
      renderKatexEquationControls(wrapper, layout, root, onChange);
    } else {
      removeLayoutInteractionChrome(wrapper);
    }
  });

  if (!isArrangeMode) {
    clearActiveLayoutDrag();
    clearLayoutInteractionState(root);
  }

  if (normalizedLayouts.length > 0) {
    onChange(normalizedLayouts);
  }

  arrangeLayoutGroups(root, filePath, layoutByKey);
}

export function reusePreviewLayoutBlocks(currentRoot: HTMLElement, nextRoot: ParentNode): void {
  const reusableBlocks = new Map<string, HTMLElement[]>();
  getLayoutWrappers(currentRoot).forEach((wrapper) => {
    layoutIdentitiesForWrapper(wrapper).forEach((identity) => {
      const blocks = reusableBlocks.get(identity) ?? [];
      blocks.push(wrapper);
      reusableBlocks.set(identity, blocks);
    });
  });

  if (reusableBlocks.size === 0) return;

  collectLayoutTargets(nextRoot).forEach((target) => {
    const reusableWrapper = takeReusableLayoutWrapper(reusableBlocks, layoutIdentitiesForTarget(target));
    if (!reusableWrapper) return;

    const parent = target.element.parentElement;
    const sourceElement =
      target.blockKind === 'image' && parent?.tagName === 'P' && isSingleImageParagraph(parent)
        ? parent
        : target.element;

    applyLayoutTargetDataset(reusableWrapper, target);
    copySourceLineDataset(sourceElement, reusableWrapper);
    sourceElement.replaceWith(reusableWrapper);

    const surface = ensureLayoutSurface(reusableWrapper);
    replaceLayoutSurfaceContent(surface, target.element, target.blockKind);
  });
}

function takeReusableLayoutWrapper(
  reusableBlocks: Map<string, HTMLElement[]>,
  identities: readonly string[],
): HTMLElement | null {
  for (const identity of identities) {
    const reusableWrapper = reusableBlocks.get(identity)?.shift();
    if (reusableWrapper) return reusableWrapper;
  }
  return null;
}
