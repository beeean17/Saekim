import { previewBoxId } from '../../core/preview/renderObjectTypes';
import type { BlockKind, BlockLayout } from '../../types/metadata';

export interface LayoutIdentityParts {
  readonly blockKind: BlockKind;
  readonly blockKey: string;
  readonly occurrenceIndex: number;
}

export interface LayoutIdentityMatch {
  readonly current: LayoutIdentityParts;
  readonly legacy: LayoutIdentityParts | null;
}

interface ElementIdentityInput {
  readonly element: HTMLElement;
  readonly blockKind: BlockKind;
  readonly legacyBlockKey: string;
  readonly legacyOccurrenceIndex: number;
}

export function layoutIdentity(layout: Pick<BlockLayout, 'blockKind' | 'blockKey' | 'occurrenceIndex'>): string {
  return `${layout.blockKind}:${layout.blockKey}:${layout.occurrenceIndex}`;
}

export function layoutIdentityMatchForElement(input: ElementIdentityInput): LayoutIdentityMatch {
  const legacy = {
    blockKind: input.blockKind,
    blockKey: input.legacyBlockKey,
    occurrenceIndex: input.legacyOccurrenceIndex,
  };
  const previewBoxKey = previewBoxLayoutKey(input.element);
  if (!previewBoxKey) return { current: legacy, legacy: null };

  return {
    current: {
      blockKind: input.blockKind,
      blockKey: previewBoxKey,
      occurrenceIndex: 0,
    },
    legacy,
  };
}

export function layoutWithIdentity(layout: BlockLayout, identity: LayoutIdentityParts): BlockLayout {
  if (
    layout.blockKind === identity.blockKind &&
    layout.blockKey === identity.blockKey &&
    layout.occurrenceIndex === identity.occurrenceIndex
  ) {
    return layout;
  }

  return {
    ...layout,
    blockKind: identity.blockKind,
    blockKey: identity.blockKey,
    occurrenceIndex: identity.occurrenceIndex,
  };
}

export function layoutIdentityForMatch(match: LayoutIdentityMatch): string {
  return layoutIdentity(match.current);
}

function previewBoxLayoutKey(element: HTMLElement): string | null {
  const directKey = previewBoxLayoutKeyFromDataset(element);
  if (directKey) return directKey;

  const child = element.querySelector<HTMLElement>(
    ':scope > .preview-layout-surface [data-preview-box-id], :scope > .preview-layout-surface [data-preview-box-key]',
  );
  return child ? previewBoxLayoutKeyFromDataset(child) : null;
}

function previewBoxLayoutKeyFromDataset(element: HTMLElement): string | null {
  const previewBoxIdValue = element.dataset.previewBoxId;
  if (previewBoxIdValue) return previewBoxIdValue;

  const previewBoxKey = element.dataset.previewBoxKey;
  return previewBoxKey ? previewBoxId(previewBoxKey) : null;
}
