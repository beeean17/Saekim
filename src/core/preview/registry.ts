import type { PreviewContribution, PreviewMatchContext, SaekimFeature } from '../../app/feature';
import { textPreviewContribution } from './textPreview';

export function selectPreviewRenderer(features: SaekimFeature[], ctx: PreviewMatchContext): PreviewContribution {
  return previewContributions(features)
    .filter((contribution) => contribution.render && contribution.match(ctx))
    .sort(byPriorityDescending)[0] ?? textPreviewContribution;
}

export function selectPreviewEnhancements(
  features: SaekimFeature[],
  ctx: PreviewMatchContext,
  baseContributions: PreviewContribution[] = [],
): PreviewContribution[] {
  return [...baseContributions, ...previewContributions(features)]
    .filter((contribution) => contribution.afterRender && contribution.match(ctx))
    .sort(byPriorityDescending);
}

function previewContributions(features: SaekimFeature[]): PreviewContribution[] {
  return features.flatMap((feature) => {
    if (!feature.preview) return [];
    return Array.isArray(feature.preview) ? feature.preview : [feature.preview];
  });
}

function byPriorityDescending(left: PreviewContribution, right: PreviewContribution): number {
  return right.priority - left.priority;
}
