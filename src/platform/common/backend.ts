import { isTauriRuntime } from './tauri/invoke';
import { androidBackend } from '../android/androidBackend';
import { browserBackend } from '../browser/browserBackend';
import { isAndroidRuntime } from './runtime';
import { tauriDesktopBackend } from '../desktop/tauriDesktopBackend';
import type { BackendAdapter } from './BackendAdapter';

export const Backend: BackendAdapter = isAndroidRuntime()
  ? androidBackend
  : isTauriRuntime()
    ? tauriDesktopBackend
    : browserBackend;

export type { BackendAdapter } from './BackendAdapter';
