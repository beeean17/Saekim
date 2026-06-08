import type { PlatformCapability } from '../common/capabilities';

export const androidCapabilities: ReadonlySet<PlatformCapability> = new Set([
  'file.open',
  'file.save',
  'metadata.sqlite',
]);
