import { browserBackend } from './browserBackend';
import { browserCapabilities } from './browserCapabilities';
import { browserPreviewSurface } from './previewSurface';
import { BasePlatformProfile } from '../common/platformProfile';

class BrowserPlatformProfile extends BasePlatformProfile {
  constructor() {
    super({
      target: 'browser',
      shellRuntime: 'browser',
      backend: browserBackend,
      capabilities: browserCapabilities,
      previewSurface: browserPreviewSurface,
      windowChrome: {
        titlebarClassName: '',
        showsApplicationMenu: false,
        syncsNativeTitlebarColor: false,
        providesNativeFullscreenCommand: false,
      },
    });
  }
}

export const browserPlatformProfile = new BrowserPlatformProfile();
