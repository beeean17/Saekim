import { androidPreviewSurface } from './previewSurface';
import { androidCapabilities } from './androidCapabilities';
import { androidBackend } from './androidBackend';
import { BasePlatformProfile } from '../common/platformProfile';

class AndroidPlatformProfile extends BasePlatformProfile {
  constructor() {
    super({
      target: 'android',
      shellRuntime: 'android',
      backend: androidBackend,
      capabilities: androidCapabilities,
      previewSurface: androidPreviewSurface,
      windowChrome: {
        titlebarClassName: '',
        showsApplicationMenu: false,
        syncsNativeTitlebarColor: false,
        providesNativeFullscreenCommand: false,
      },
    });
  }
}

export const androidPlatformProfile = new AndroidPlatformProfile();
