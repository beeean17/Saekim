import type { PlatformCapability } from '../common/capabilityTypes';

export const browserCapabilities: ReadonlySet<PlatformCapability> = new Set([
  'file.open',
  'file.save',
  'folder.open',
  'folder.tree',
  'image.pick',
  'image.copyToAssets',
  'image.importBytesToAssets',
  'image.downloadToAssets',
  'pdf.save',
  'metadata.sqlite',
  'window.fullscreen',
]);
