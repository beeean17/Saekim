import { useEffect } from 'react';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { isTauriRuntime } from '../platform/common/tauri/invoke';
import { translateCurrent } from '../i18n/current';
import { notify, notifyError } from '../core/notifications';

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

    /*
     * An update is news, not an interruption. A modal confirm used to block the
     * app the moment it launched, before the user had even seen their document;
     * this waits in the corner until they choose to act on it.
     */
    notify(translateCurrent('update.available', { version: update.version }), {
      key: 'app-update',
      tone: 'info',
      timeout: null,
      action: {
        label: translateCurrent('update.install'),
        run: () => {
          void (async () => {
            try {
              notify(translateCurrent('update.installing'), { key: 'app-update', tone: 'info', timeout: null });
              await update.downloadAndInstall();
              await relaunch();
            } catch (error) {
              console.warn('Saekim update install failed', error);
              notifyError(translateCurrent('update.failed'), error, { key: 'app-update' });
            }
          })();
        },
      },
    });
  } catch (error) {
    console.warn('Saekim update check failed', error);
  }
}
