import type { SaekimFeature } from './feature';
import { htmlPreviewContribution } from '../features/html-preview';
import '../features/katex';
import { markdownPreviewContribution } from '../features/markdown';
import { mermaidPreviewEnhancement } from '../features/mermaid';
import { structuredDataPreviewContribution, tabularDataPreviewContribution } from '../features/structured-data';

export const enabledFeatures: SaekimFeature[] = [
  { id: 'file-workspace', label: 'File Workspace' },
  {
    id: 'markdown',
    label: 'Markdown',
    preview: markdownPreviewContribution,
    fileTypes: {
      extensions: ['md', 'markdown', 'mdown', 'mkd'],
      label: 'md',
      language: 'markdown',
      previewKind: 'markdown',
    },
  },
  { id: 'mermaid', label: 'Mermaid', dependsOn: ['markdown'], preview: mermaidPreviewEnhancement },
  { id: 'katex', label: 'KaTeX', dependsOn: ['markdown'] },
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
  { id: 'image-assets', label: 'Image Assets', dependsOn: ['markdown'] },
  { id: 'block-layout', label: 'Block Layout', dependsOn: ['markdown'] },
  { id: 'pdf-export', label: 'PDF Export' },
  { id: 'search', label: 'Search' },
];
