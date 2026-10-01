import { desktopCapabilities } from '../desktopCapabilities';
import { BaseDesktopPlatformProfile } from '../common/baseDesktopPlatformProfile';

class WindowsPlatformProfile extends BaseDesktopPlatformProfile {
  constructor() {
    super({
      target: 'windows',
      capabilities: desktopCapabilities,
      windowChrome: {
        titlebarClassName: 'windows-titlebar menu-titlebar',
        showsApplicationMenu: true,
        syncsNativeTitlebarColor: true,
        providesNativeFullscreenCommand: false,
      },
    });
  }
}

export const windowsPlatformProfile = new WindowsPlatformProfile();
