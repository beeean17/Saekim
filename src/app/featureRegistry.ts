import type { SaekimFeature } from './feature';

export const enabledFeatures: SaekimFeature[] = [
  { id: 'file-workspace', label: 'File Workspace' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'mermaid', label: 'Mermaid', dependsOn: ['markdown'] },
  { id: 'katex', label: 'KaTeX', dependsOn: ['markdown'] },
  { id: 'structured-data', label: 'Structured Data' },
  { id: 'html-preview', label: 'HTML Preview' },
  { id: 'image-assets', label: 'Image Assets', dependsOn: ['markdown'] },
  { id: 'block-layout', label: 'Block Layout', dependsOn: ['markdown'] },
  { id: 'pdf-export', label: 'PDF Export' },
  { id: 'search', label: 'Search' },
];
