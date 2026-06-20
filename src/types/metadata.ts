export type BlockKind = 'text' | 'image' | 'table' | 'list' | 'blockquote' | 'code' | 'mermaid' | 'katex';
export type LayoutUnit = 'px' | '%' | 'auto';
export type LayoutAlign = 'left' | 'center' | 'right';
export type LayoutFlow = 'document-flow' | 'freeform';

export interface BlockLayout {
  filePath: string;
  blockKind: BlockKind;
  blockKey: string;
  occurrenceIndex: number;
  boxId?: string | null;
  boxKind?: string | null;
  flow?: LayoutFlow | null;
  xValue?: number | null;
  yValue?: number | null;
  widthValue: number | null;
  widthUnit: LayoutUnit;
  heightValue: number | null;
  heightUnit: LayoutUnit;
  align: LayoutAlign;
  zIndex?: number | null;
  sourceLine?: number | null;
  sourceEndLine?: number | null;
  contentHash?: string | null;
  identityHash?: string | null;
  layoutJson?: Record<string, unknown> | null;
}
