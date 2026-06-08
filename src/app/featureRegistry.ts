import type { SaekimFeature } from './feature';
import { htmlPreviewContribution } from '../features/html-preview';
import { imageAssetsEditorContribution } from '../features/image-assets';
import { katexEditorContribution } from '../features/katex';
import { markdownEditorContribution, markdownPreviewContribution } from '../features/markdown';
import { mermaidEditorContribution, mermaidPreviewEnhancement } from '../features/mermaid';
import { blockLayoutMetadataContribution, blockLayoutPreviewEnhancement } from '../features/block-layout';
import { pdfExportCommands, pdfExportContribution } from '../features/pdf-export';
import { searchCommands, searchEditorContribution } from '../features/search';
import { structuredDataPreviewContribution, tabularDataPreviewContribution } from '../features/structured-data';
import { currentPlatformCapabilities, type PlatformCapability } from '../platform/common/capabilities';

const featureCatalog: SaekimFeature[] = [
  {
    id: 'file-workspace',
    label: 'File Workspace',
    requiresCapabilities: {
      required: ['file.open', 'file.save'],
      optional: ['folder.open', 'folder.tree', 'externalFile.open'],
    },
  },
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
  {
    id: 'image-assets',
    label: 'Image Assets',
    dependsOn: ['markdown'],
    requiresCapabilities: {
      required: ['image.pick', 'image.copyToAssets', 'image.importBytesToAssets', 'image.downloadToAssets'],
    },
    editor: imageAssetsEditorContribution,
  },
  { id: 'metadata', label: 'Metadata', requiresCapabilities: { required: ['metadata.sqlite'] } },
  {
    id: 'block-layout',
    label: 'Block Layout',
    dependsOn: ['markdown', 'metadata'],
    requiresCapabilities: { required: ['metadata.sqlite'] },
    preview: blockLayoutPreviewEnhancement,
    metadata: blockLayoutMetadataContribution,
  },
  {
    id: 'pdf-export',
    label: 'PDF Export',
    requiresCapabilities: { required: ['pdf.save'] },
    commands: pdfExportCommands,
    pdf: pdfExportContribution,
  },
  { id: 'search', label: 'Search', editor: searchEditorContribution, commands: searchCommands },
];

export const enabledFeatures = selectSupportedFeatures(featureCatalog, currentPlatformCapabilities());

validateFeatureGraph(enabledFeatures, currentPlatformCapabilities());

export function selectSupportedFeatures(
  features: SaekimFeature[],
  capabilities: ReadonlySet<PlatformCapability>,
): SaekimFeature[] {
  let supported = features.filter((feature) => hasRequiredCapabilities(feature, capabilities));
  let changed = true;

  while (changed) {
    changed = false;
    const ids = new Set(supported.map((feature) => feature.id));
    const next = supported.filter((feature) => (feature.dependsOn ?? []).every((dependency) => ids.has(dependency)));
    if (next.length !== supported.length) {
      supported = next;
      changed = true;
    }
  }

  return supported;
}

export function validateFeatureGraph(
  features: SaekimFeature[],
  capabilities: ReadonlySet<PlatformCapability> = currentPlatformCapabilities(),
): void {
  const ids = new Set(features.map((feature) => feature.id));

  for (const feature of features) {
    for (const dependency of feature.dependsOn ?? []) {
      if (!ids.has(dependency)) {
        throw new Error(`Feature "${feature.id}" requires "${dependency}", which is not enabled.`);
      }
    }

    const missingCapabilities = (feature.requiresCapabilities?.required ?? []).filter(
      (capability) => !capabilities.has(capability),
    );
    if (missingCapabilities.length > 0) {
      throw new Error(
        `Feature "${feature.id}" requires unsupported platform capabilities: ${missingCapabilities.join(', ')}`,
      );
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

function hasRequiredCapabilities(feature: SaekimFeature, capabilities: ReadonlySet<PlatformCapability>): boolean {
  return (feature.requiresCapabilities?.required ?? []).every((capability) => capabilities.has(capability));
}
