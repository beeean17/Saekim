import type { PreviewSurfaceAdapter } from '../../core/preview/surfacePolicy';
import type { BackendAdapter } from './BackendAdapter';
import type { PlatformCapability } from './capabilityTypes';

export const PLATFORM_TARGETS = ['macos', 'windows', 'linux', 'android', 'browser'] as const;
export type PlatformTarget = (typeof PLATFORM_TARGETS)[number];

export type DesktopPlatformTarget = Extract<PlatformTarget, 'macos' | 'windows' | 'linux'>;

export const PLATFORM_SHELL_RUNTIMES = ['desktop', 'android', 'browser'] as const;
export type PlatformShellRuntime = (typeof PLATFORM_SHELL_RUNTIMES)[number];

export interface WindowChromeProfile {
  readonly titlebarClassName: string;
  readonly showsApplicationMenu: boolean;
  readonly syncsNativeTitlebarColor: boolean;
  /**
   * True where the operating system's own menu already offers full screen on
   * its standard key. The app must then leave that key alone: binding it here
   * as well toggles the window twice and lands it back where it started.
   */
  readonly providesNativeFullscreenCommand: boolean;
}

export interface PlatformProfile {
  readonly target: PlatformTarget;
  readonly shellRuntime: PlatformShellRuntime;
  readonly backend: BackendAdapter;
  readonly capabilities: ReadonlySet<PlatformCapability>;
  readonly previewSurface: PreviewSurfaceAdapter;
  readonly windowChrome: WindowChromeProfile;
}

interface PlatformProfileConfig {
  readonly target: PlatformTarget;
  readonly shellRuntime: PlatformShellRuntime;
  readonly backend: BackendAdapter;
  readonly capabilities: ReadonlySet<PlatformCapability>;
  readonly previewSurface: PreviewSurfaceAdapter;
  readonly windowChrome: WindowChromeProfile;
}

export abstract class BasePlatformProfile implements PlatformProfile {
  private readonly profile: PlatformProfileConfig;

  protected constructor(profile: PlatformProfileConfig) {
    this.profile = profile;
  }

  get target(): PlatformTarget {
    return this.profile.target;
  }

  get shellRuntime(): PlatformShellRuntime {
    return this.profile.shellRuntime;
  }

  get backend(): BackendAdapter {
    return this.profile.backend;
  }

  get capabilities(): ReadonlySet<PlatformCapability> {
    return this.profile.capabilities;
  }

  get previewSurface(): PreviewSurfaceAdapter {
    return this.profile.previewSurface;
  }

  get windowChrome(): WindowChromeProfile {
    return this.profile.windowChrome;
  }
}
