import { isTauriRuntime } from '../../lib/tauri/invoke';
import { androidCapabilities } from '../android/androidCapabilities';
import { browserCapabilities } from '../browser/browserCapabilities';
import { desktopCapabilities } from '../desktop/desktopCapabilities';
import { isAndroidRuntime } from './runtime';

export type PlatformCapability =
  | 'file.open'
  | 'file.save'
  | 'folder.open'
  | 'folder.tree'
  | 'image.pick'
  | 'image.copyToAssets'
  | 'image.importBytesToAssets'
  | 'image.downloadToAssets'
  | 'pdf.save'
  | 'metadata.sqlite'
  | 'externalFile.open'
  | 'window.chrome'
  | 'native.menu';

export function currentPlatformCapabilities(): ReadonlySet<PlatformCapability> {
  if (isAndroidRuntime()) return androidCapabilities;
  return isTauriRuntime() ? desktopCapabilities : browserCapabilities;
}
