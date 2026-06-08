import type { PreviewContribution } from '../../app/feature';
import { StructuredDataPreview, TabularDataPreview } from './StructuredDataPreview';

export const structuredDataPreviewContribution: PreviewContribution = {
  id: 'structured-data.preview',
  priority: 55,
  match: ({ fileType }) => fileType.previewKind === 'structured-data',
  render({ file, fileType }) {
    return {
      kind: 'react',
      renderKey: file.id,
      node: <StructuredDataPreview content={file.content} fileType={fileType} fileKey={file.id} />,
    };
  },
};

export const tabularDataPreviewContribution: PreviewContribution = {
  id: 'structured-data.tabular-preview',
  priority: 55,
  match: ({ fileType }) => fileType.previewKind === 'tabular-data',
  render({ file, fileType }) {
    return {
      kind: 'react',
      renderKey: file.id,
      node: <TabularDataPreview content={file.content} fileType={fileType} />,
    };
  },
};
