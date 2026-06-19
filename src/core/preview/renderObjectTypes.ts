export const PREVIEW_BOX_KINDS = [
  'text',
  'special',
  'image',
  'table',
  'markdown',
  'katex',
  'html',
] as const;

export type PreviewBoxKind = (typeof PREVIEW_BOX_KINDS)[number];
export type PreviewBoxFlow = 'document-flow' | 'freeform';
export type PreviewBoxId = `preview-box:${string}`;

export interface PreviewPoint {
  readonly x: number;
  readonly y: number;
}

export interface PreviewSize {
  readonly width: number;
  readonly height: number;
}

export interface PreviewBoxBounds extends PreviewPoint, PreviewSize {}

export interface PreviewResizeLimits {
  readonly min: PreviewSize;
  readonly max: PreviewSize | null;
}

export interface PreviewBoxSnapshot {
  readonly id: PreviewBoxId;
  readonly kind: PreviewBoxKind;
  readonly bounds: PreviewBoxBounds;
  readonly flow: PreviewBoxFlow;
  readonly zIndex: number;
}

export interface PreviewRenderBox {
  readonly id: PreviewBoxId;
  readonly kind: PreviewBoxKind;
  readonly bounds: PreviewBoxBounds;
  readonly resizeLimits: PreviewResizeLimits;
  readonly flow: PreviewBoxFlow;
  readonly zIndex: number;
  moveTo(point: PreviewPoint): void;
  resizeTo(size: PreviewSize): void;
  setBounds(bounds: PreviewBoxBounds): void;
  snapshot(): PreviewBoxSnapshot;
}

export interface PreviewTextBox extends PreviewRenderBox {
  readonly text: string;
}

export interface PreviewSpecialBlock<TItem> extends PreviewTextBox {
  readonly item: TItem;
}

export interface PreviewImageBlockItem {
  readonly src: string;
  readonly alt: string;
  readonly intrinsicSize: PreviewSize | null;
}

export type PreviewTableCell = string | number | boolean | null;

export interface PreviewTableBlockItem {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly PreviewTableCell[])[];
}

export interface PreviewMarkdownBlockItem {
  readonly source: string;
  readonly renderedHtml: string | null;
}

export interface PreviewKatexBlockItem {
  readonly expression: string;
  readonly displayMode: boolean;
}

export function previewBoxId(seed: string): PreviewBoxId {
  return `preview-box:${seed}`;
}
