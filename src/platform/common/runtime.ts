import { isTauriRuntime } from './tauri/invoke';
import type { DesktopPlatformTarget } from './platformProfile';

export function isAndroidRuntime(): boolean {
  return isTauriRuntime() && typeof navigator !== 'undefined' && /\bAndroid\b/i.test(navigator.userAgent);
}

export function detectDesktopHostOs(): DesktopPlatformTarget {
  if (typeof navigator === 'undefined') return 'linux';

  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  if (platform.startsWith('win') || userAgent.includes('windows')) return 'windows';
  if (platform.includes('mac') || userAgent.includes('mac os')) return 'macos';
  return 'linux';
}
