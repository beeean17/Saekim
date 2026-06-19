import type { PreviewContribution, PreviewRenderContext, PreviewResult } from '../../app/feature';

export type PreviewRendererContribution = PreviewContribution & {
  readonly render: (ctx: PreviewRenderContext) => PreviewResult | Promise<PreviewResult>;
};

export interface PreviewRenderSnapshot {
  readonly context: PreviewRenderContext;
  readonly renderer: PreviewRendererContribution;
  readonly enhancements: readonly PreviewContribution[];
  readonly result: PreviewResult;
}
