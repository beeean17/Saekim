import type { BlockLayout } from '../../types/metadata';

export type BlockLayoutChange = BlockLayout | BlockLayout[];
export type LayoutChangeHandler = (layout: BlockLayoutChange) => void;
export type LayoutByKey = Map<string, BlockLayout>;

export interface LayoutTarget {
  readonly element: HTMLElement;
  readonly blockKind: BlockLayout['blockKind'];
  readonly blockKey: string;
  readonly occurrenceIndex: number;
  readonly legacyBlockKey: string | null;
  readonly legacyOccurrenceIndex: number | null;
}
