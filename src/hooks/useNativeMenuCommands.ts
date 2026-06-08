import { useEffect } from 'react';
import type { NativeMenuCommandHandlers } from '../platform/common/BackendAdapter';
import { Backend } from '../platform/common/backend';
import { currentPlatformCapabilities } from '../platform/common/capabilities';

export function useNativeMenuCommands(handlers: NativeMenuCommandHandlers): void {
  useEffect(() => {
    if (!Backend.runtime.isTauriRuntime() || !currentPlatformCapabilities().has('native.menu')) return;

    let disposed = false;
    let unlisten: (() => void) | null = null;

    void Backend.runtime
      .listenNativeMenuCommands(handlers)
      .then((nextUnlisten) => {
        if (disposed) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch((error) => {
        console.error('네이티브 메뉴 연결 실패:', error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handlers]);
}
