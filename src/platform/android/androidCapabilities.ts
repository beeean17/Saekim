import type { PlatformCapability } from '../common/capabilityTypes';

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
