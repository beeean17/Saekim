import type {
  PreviewBoxBounds,
  PreviewBoxFlow,
  PreviewBoxId,
  PreviewBoxKind,
  PreviewBoxSnapshot,
  PreviewImageBlockItem,
  PreviewKatexBlockItem,
  PreviewMarkdownBlockItem,
  PreviewPoint,
  PreviewRenderBox,
  PreviewResizeLimits,
  PreviewSize,
  PreviewSpecialBlock,
  PreviewTableBlockItem,
  PreviewTextBox,
} from './renderObjectTypes';

interface BaseRenderBoxInit<TKind extends PreviewBoxKind> {
  readonly id: PreviewBoxId;
  readonly kind: TKind;
  readonly bounds: PreviewBoxBounds;
  readonly resizeLimits?: PreviewResizeLimits;
  readonly flow?: PreviewBoxFlow;
  readonly zIndex?: number;
}

interface TextRenderBoxInit<TKind extends PreviewBoxKind> extends BaseRenderBoxInit<TKind> {
  readonly text: string;
}

interface SpecialRenderBlockInit<TKind extends PreviewBoxKind, TItem> extends TextRenderBoxInit<TKind> {
  readonly item: TItem;
}

type TextBoxInit = Omit<TextRenderBoxInit<'text'>, 'kind'>;
type SpecialBlockInput<TKind extends PreviewBoxKind, TItem> = Omit<SpecialRenderBlockInit<TKind, TItem>, 'kind'>;

const DEFAULT_RESIZE_LIMITS: PreviewResizeLimits = {
  min: { width: 24, height: 24 },
  max: null,
};

export abstract class BaseRenderBox<TKind extends PreviewBoxKind> implements PreviewRenderBox {
  private currentBounds: PreviewBoxBounds;

  readonly id: PreviewBoxId;
  readonly kind: TKind;
  readonly resizeLimits: PreviewResizeLimits;
  readonly flow: PreviewBoxFlow;
  readonly zIndex: number;

  protected constructor(init: BaseRenderBoxInit<TKind>) {
    this.id = init.id;
    this.kind = init.kind;
    this.currentBounds = init.bounds;
    this.resizeLimits = init.resizeLimits ?? DEFAULT_RESIZE_LIMITS;
    this.flow = init.flow ?? 'document-flow';
    this.zIndex = init.zIndex ?? 0;
  }

  get bounds(): PreviewBoxBounds {
    return this.currentBounds;
  }

  moveTo(point: PreviewPoint): void {
    this.currentBounds = {
      ...this.currentBounds,
      x: point.x,
      y: point.y,
    };
  }

  resizeTo(size: PreviewSize): void {
    this.currentBounds = {
      ...this.currentBounds,
      width: clampDimension(size.width, this.resizeLimits.min.width, this.resizeLimits.max?.width ?? null),
      height: clampDimension(size.height, this.resizeLimits.min.height, this.resizeLimits.max?.height ?? null),
    };
  }

  setBounds(bounds: PreviewBoxBounds): void {
    this.moveTo(bounds);
    this.resizeTo(bounds);
  }

  snapshot(): PreviewBoxSnapshot {
    return {
      id: this.id,
      kind: this.kind,
      bounds: this.currentBounds,
      flow: this.flow,
      zIndex: this.zIndex,
    };
  }
}

export class TextRenderBox<TKind extends PreviewBoxKind = 'text'>
  extends BaseRenderBox<TKind>
  implements PreviewTextBox
{
  readonly text: string;

  constructor(init: TextRenderBoxInit<TKind>) {
    super(init);
    this.text = init.text;
  }
}

export class SpecialRenderBlock<TKind extends PreviewBoxKind, TItem>
  extends TextRenderBox<TKind>
  implements PreviewSpecialBlock<TItem>
{
  readonly item: TItem;

  constructor(init: SpecialRenderBlockInit<TKind, TItem>) {
    super(init);
    this.item = init.item;
  }
}

export class TextBox extends TextRenderBox<'text'> {
  constructor(init: TextBoxInit) {
    super({ ...init, kind: 'text' });
  }
}

export class SpecialBlock<TItem> extends SpecialRenderBlock<'special', TItem> {
  constructor(init: SpecialBlockInput<'special', TItem>) {
    super({ ...init, kind: 'special' });
  }
}

export class ImageRenderBlock extends SpecialRenderBlock<'image', PreviewImageBlockItem> {
  constructor(init: SpecialBlockInput<'image', PreviewImageBlockItem>) {
    super({ ...init, kind: 'image' });
  }
}

export class TableRenderBlock extends SpecialRenderBlock<'table', PreviewTableBlockItem> {
  constructor(init: SpecialBlockInput<'table', PreviewTableBlockItem>) {
    super({ ...init, kind: 'table' });
  }
}

export class MarkdownRenderBlock extends SpecialRenderBlock<'markdown', PreviewMarkdownBlockItem> {
  constructor(init: SpecialBlockInput<'markdown', PreviewMarkdownBlockItem>) {
    super({ ...init, kind: 'markdown' });
  }
}

export class KatexRenderBlock extends SpecialRenderBlock<'katex', PreviewKatexBlockItem> {
  constructor(init: SpecialBlockInput<'katex', PreviewKatexBlockItem>) {
    super({ ...init, kind: 'katex' });
  }
}

function clampDimension(value: number, min: number, max: number | null): number {
  if (value < min) return min;
  if (max !== null && value > max) return max;
  return value;
}
