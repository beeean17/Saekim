import { useEffect } from 'react';
import type { NativeMenuCommandHandlers } from '../platform/common/BackendAdapter';
import { Backend } from '../platform/common/backend';
import { currentPlatformCapabilities } from '../platform/common/capabilities';

export function useNativeMenuCommands(handlers: NativeMenuCommandHandlers): void {
  useEffect(() => {
    const isTauriRuntime = Backend.runtime.isTauriRuntime();
    const hasNativeMenu = currentPlatformCapabilities().has('native.menu');
    if (!isTauriRuntime || !hasNativeMenu) {
      if (isTauriRuntime) {
        void Backend.runtime.logEvent('native-menu', 'hook skipped', { isTauriRuntime, hasNativeMenu });
      }
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;
    void Backend.runtime.logEvent('native-menu', 'hook enabled');

    void Backend.runtime
      .listenNativeMenuCommands(handlers)
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          void Backend.runtime.logEvent('native-menu', 'hook disposed before listener ready');
        } else {
          unlisten = nextUnlisten;
          void Backend.runtime.logEvent('native-menu', 'hook listening');
        }
      })
      .catch((error) => {
        console.error('네이티브 메뉴 연결 실패:', error);
        void Backend.runtime.logEvent('native-menu', 'hook listener failed', renderNativeMenuError(error));
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handlers]);
}

function renderNativeMenuError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? '',
    };
  }

  return { message: String(error) };
}
