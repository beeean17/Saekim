import type { AppContribution, SaekimFeature } from '../../app/feature';

export function selectAppOverlays(features: SaekimFeature[]): NonNullable<AppContribution['overlays']> {
  return features.flatMap((feature) => {
    if (!feature.app) return [];
    const contributions = Array.isArray(feature.app) ? feature.app : [feature.app];
    return contributions.flatMap((contribution) => contribution.overlays ?? []);
  });
}
