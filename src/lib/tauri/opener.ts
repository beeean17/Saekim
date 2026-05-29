import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './invoke';

export async function openExternalUrl(url: string): Promise<void> {
  if (!isExternalUrl(url)) return;

  if (isTauriRuntime()) {
    await invoke('open_external_url', { url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:', 'tel:', 'file:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
