import type { EditorContribution, SaekimFeature } from '../../app/feature';

export interface EditorContributionSet {
  toolbar: NonNullable<EditorContribution['toolbar']>;
  overlays: NonNullable<EditorContribution['overlays']>;
  helpers: NonNullable<EditorContribution['helpers']>;
  handlers: NonNullable<EditorContribution['handlers']>[];
  imageActions: NonNullable<EditorContribution['imageActions']>[];
}

export function selectEditorContributions(features: SaekimFeature[]): EditorContributionSet {
  const contributions = editorContributions(features);
  return {
    toolbar: contributions.flatMap((contribution) => contribution.toolbar ?? []),
    overlays: contributions.flatMap((contribution) => contribution.overlays ?? []),
    helpers: contributions.flatMap((contribution) => contribution.helpers ?? []),
    handlers: contributions.flatMap((contribution) => (contribution.handlers ? [contribution.handlers] : [])),
    imageActions: contributions.flatMap((contribution) => (contribution.imageActions ? [contribution.imageActions] : [])),
  };
}

function editorContributions(features: SaekimFeature[]): EditorContribution[] {
  return features.flatMap((feature) => {
    if (!feature.editor) return [];
    return Array.isArray(feature.editor) ? feature.editor : [feature.editor];
  });
}
