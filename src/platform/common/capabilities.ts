import { Platform } from './platform';
import type { PlatformCapability } from './capabilityTypes';

export type { PlatformCapability } from './capabilityTypes';

export function currentPlatformCapabilities(): ReadonlySet<PlatformCapability> {
  return Platform.capabilities;
}
