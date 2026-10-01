import { desktopCapabilities } from '../desktopCapabilities';
import { BaseDesktopPlatformProfile } from '../common/baseDesktopPlatformProfile';

class LinuxPlatformProfile extends BaseDesktopPlatformProfile {
  constructor() {
    super({
      target: 'linux',
      capabilities: desktopCapabilities,
      windowChrome: {
        titlebarClassName: '',
        showsApplicationMenu: true,
        syncsNativeTitlebarColor: true,
        providesNativeFullscreenCommand: false,
      },
    });
  }
}

export const linuxPlatformProfile = new LinuxPlatformProfile();
