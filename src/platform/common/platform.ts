import { androidPlatformProfile } from '../android/androidPlatformProfile';
import { browserPlatformProfile } from '../browser/browserPlatformProfile';
import { linuxPlatformProfile } from '../desktop/linux/linuxPlatformProfile';
import { macosPlatformProfile } from '../desktop/macos/macosPlatformProfile';
import { windowsPlatformProfile } from '../desktop/windows/windowsPlatformProfile';
import type { PlatformProfile } from './platformProfile';
import { detectDesktopHostOs, isAndroidRuntime } from './runtime';
import { isTauriRuntime } from './tauri/invoke';

export const Platform: PlatformProfile = selectPlatformProfile();

function selectPlatformProfile(): PlatformProfile {
  if (!isTauriRuntime()) return browserPlatformProfile;
  if (isAndroidRuntime()) return androidPlatformProfile;

  const hostOs = detectDesktopHostOs();
  switch (hostOs) {
    case 'macos':
      return macosPlatformProfile;
    case 'windows':
      return windowsPlatformProfile;
    case 'linux':
      return linuxPlatformProfile;
    default:
      return assertNever(hostOs);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported desktop platform target: ${value}`);
}
