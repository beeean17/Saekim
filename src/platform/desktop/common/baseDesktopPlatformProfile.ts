import { desktopPreviewSurface } from '../previewSurface';
import { tauriDesktopBackend } from '../tauriDesktopBackend';
import { BasePlatformProfile, type DesktopPlatformTarget, type WindowChromeProfile } from '../../common/platformProfile';
import type { PlatformCapability } from '../../common/capabilityTypes';

interface DesktopPlatformProfileConfig {
  readonly target: DesktopPlatformTarget;
  readonly capabilities: ReadonlySet<PlatformCapability>;
  readonly windowChrome: WindowChromeProfile;
}

export abstract class BaseDesktopPlatformProfile extends BasePlatformProfile {
  protected constructor(config: DesktopPlatformProfileConfig) {
    super({
      target: config.target,
      shellRuntime: 'desktop',
      backend: tauriDesktopBackend,
      capabilities: config.capabilities,
      previewSurface: desktopPreviewSurface,
      windowChrome: config.windowChrome,
    });
  }
}
