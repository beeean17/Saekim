import { desktopCapabilities } from '../desktopCapabilities';
import { BaseDesktopPlatformProfile } from '../common/baseDesktopPlatformProfile';

class MacOSPlatformProfile extends BaseDesktopPlatformProfile {
  constructor() {
    super({
      target: 'macos',
      capabilities: desktopCapabilities,
      windowChrome: {
        titlebarClassName: '',
        showsApplicationMenu: false,
        syncsNativeTitlebarColor: true,
      },
    });
  }
}

export const macosPlatformProfile = new MacOSPlatformProfile();
