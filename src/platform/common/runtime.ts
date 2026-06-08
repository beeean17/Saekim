import { isTauriRuntime } from '../../lib/tauri/invoke';

export function isAndroidRuntime(): boolean {
  return isTauriRuntime() && typeof navigator !== 'undefined' && /\bAndroid\b/i.test(navigator.userAgent);
}
