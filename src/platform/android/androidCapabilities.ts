import type { PlatformCapability } from '../common/capabilities';

export const androidCapabilities: ReadonlySet<PlatformCapability> = new Set([
  'file.open',
  'file.save',
  'folder.open',
  'folder.tree',
  'image.pick',
  'image.copyToAssets',
  'image.importBytesToAssets',
  'image.downloadToAssets',
  'externalFile.open',
  'metadata.sqlite',
]);
