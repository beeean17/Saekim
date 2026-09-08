import { useEffect } from 'react';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { isTauriRuntime } from '../platform/common/tauri/invoke';
import { translateCurrent } from '../i18n/current';

let updateCheckStarted = false;

export function useAutoUpdater(): void {
  useEffect(() => {
    if (updateCheckStarted || !shouldCheckForUpdates()) return;
    updateCheckStarted = true;

    void checkForUpdate();
  }, []);
}

function shouldCheckForUpdates(): boolean {
  return import.meta.env.VITE_UPDATER_ENABLED === 'true' && isTauriRuntime();
}

async function checkForUpdate(): Promise<void> {
  try {
    const update = await check();
    if (!update) return;

    const accepted = window.confirm(translateCurrent('update.available', { version: update.version }));
    if (!accepted) {
      await update.close();
      return;
    }

    await update.downloadAndInstall();
    await relaunch();
  } catch (error) {
    console.warn('Saekim update check failed', error);
  }
}
