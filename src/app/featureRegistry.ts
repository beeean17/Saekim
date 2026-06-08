import type { SaekimFeature } from './feature';
import { htmlPreviewContribution } from '../features/html-preview';
import { imageAssetsEditorContribution } from '../features/image-assets';
import { katexEditorContribution } from '../features/katex';
import { markdownEditorContribution, markdownPreviewContribution } from '../features/markdown';
import { mermaidEditorContribution, mermaidPreviewEnhancement } from '../features/mermaid';
import { searchCommands, searchEditorContribution } from '../features/search';
import { structuredDataPreviewContribution, tabularDataPreviewContribution } from '../features/structured-data';

export const enabledFeatures: SaekimFeature[] = [
  { id: 'file-workspace', label: 'File Workspace' },
  {
    id: 'markdown',
    label: 'Markdown',
    preview: markdownPreviewContribution,
    editor: markdownEditorContribution,
    fileTypes: {
      extensions: ['md', 'markdown', 'mdown', 'mkd'],
      label: 'md',
      language: 'markdown',
      previewKind: 'markdown',
    },
  },
  {
    id: 'mermaid',
    label: 'Mermaid',
    dependsOn: ['markdown'],
    preview: mermaidPreviewEnhancement,
    editor: mermaidEditorContribution,
  },
  { id: 'katex', label: 'KaTeX', dependsOn: ['markdown'], editor: katexEditorContribution },
  {
    id: 'structured-data',
    label: 'Structured Data',
    preview: [structuredDataPreviewContribution, tabularDataPreviewContribution],
    fileTypes: [
      { extensions: ['json'], label: 'json', language: 'json', previewKind: 'structured-data' },
      { extensions: ['yml', 'yaml'], label: 'yaml', language: 'yaml', previewKind: 'structured-data' },
      { extensions: ['toml'], label: 'toml', language: 'toml', previewKind: 'structured-data' },
      { extensions: ['csv'], label: 'csv', language: 'csv', previewKind: 'tabular-data' },
      { extensions: ['tsv'], label: 'tsv', language: 'tsv', previewKind: 'tabular-data' },
    ],
  },
  {
    id: 'html-preview',
    label: 'HTML Preview',
    preview: htmlPreviewContribution,
    fileTypes: {
      extensions: ['html', 'htm'],
      label: 'html',
      language: 'html',
      previewKind: 'html',
    },
  },
  { id: 'image-assets', label: 'Image Assets', dependsOn: ['markdown'], editor: imageAssetsEditorContribution },
  { id: 'block-layout', label: 'Block Layout', dependsOn: ['markdown'] },
  { id: 'pdf-export', label: 'PDF Export' },
  { id: 'search', label: 'Search', editor: searchEditorContribution, commands: searchCommands },
];

validateFeatureGraph(enabledFeatures);

export function validateFeatureGraph(features: SaekimFeature[]): void {
  const ids = new Set(features.map((feature) => feature.id));

  for (const feature of features) {
    for (const dependency of feature.dependsOn ?? []) {
      if (!ids.has(dependency)) {
        throw new Error(`Feature "${feature.id}" requires "${dependency}", which is not enabled.`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(features.map((feature) => [feature.id, feature]));

  const visit = (feature: SaekimFeature, path: string[]) => {
    if (visited.has(feature.id)) return;
    if (visiting.has(feature.id)) {
      throw new Error(`Feature dependency cycle detected: ${[...path, feature.id].join(' -> ')}`);
    }

    visiting.add(feature.id);
    for (const dependency of feature.dependsOn ?? []) {
      const dependencyFeature = byId.get(dependency);
      if (dependencyFeature) visit(dependencyFeature, [...path, feature.id]);
    }
    visiting.delete(feature.id);
    visited.add(feature.id);
  };

  features.forEach((feature) => visit(feature, []));
}
