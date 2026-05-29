export type BlockKind = 'image' | 'table' | 'list' | 'blockquote' | 'mermaid' | 'katex';
export type LayoutUnit = 'px' | '%' | 'auto';
export type LayoutAlign = 'left' | 'center' | 'right';

export interface BlockLayout {
  filePath: string;
  blockKind: BlockKind;
  blockKey: string;
  occurrenceIndex: number;
  widthValue: number | null;
  widthUnit: LayoutUnit;
  heightValue: number | null;
  heightUnit: LayoutUnit;
  align: LayoutAlign;
  layoutJson?: Record<string, unknown> | null;
}
