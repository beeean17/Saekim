import type { PlatformCapability } from '../platform/common/capabilities';

export interface SaekimFeature {
  id: string;
  label: string;
  dependsOn?: string[];
  requiresCapabilities?: FeatureCapabilityRequirements;
}

export interface FeatureCapabilityRequirements {
  required?: PlatformCapability[];
  optional?: PlatformCapability[];
}
