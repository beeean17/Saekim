import type { SaekimFeature, SidebarContribution } from '../../app/feature';

export function selectSidebarContributions(features: SaekimFeature[]): SidebarContribution[] {
  return features.flatMap((feature) => {
    if (!feature.sidebar) return [];
    return Array.isArray(feature.sidebar) ? feature.sidebar : [feature.sidebar];
  });
}
