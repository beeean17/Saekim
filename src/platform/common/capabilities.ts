import { isTauriRuntime } from '../../lib/tauri/invoke';
import { browserCapabilities } from '../browser/browserCapabilities';
import { desktopCapabilities } from '../desktop/desktopCapabilities';

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
  return isTauriRuntime() ? desktopCapabilities : browserCapabilities;
}
