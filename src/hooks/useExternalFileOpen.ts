import { useCallback, useEffect, useRef } from 'react';
import { Backend } from '../platform/common/backend';
import { currentPlatformCapabilities } from '../platform/common/capabilities';
import { useUIStore } from '../store/ui';

export function useExternalFileOpen(openFile: (path: string) => Promise<void>, enabled: boolean): void {
  const enabledRef = useRef(enabled);
  const queuedPathsRef = useRef<string[]>([]);
  const openingRef = useRef(false);
  const disposedRef = useRef(false);
  const startupFlushRef = useRef(true);
  const setSyncScroll = useUIStore((state) => state.setSyncScroll);

  const flushQueuedPaths = useCallback(async () => {
    if (
      !Backend.runtime.isTauriRuntime() ||
      !currentPlatformCapabilities().has('externalFile.open') ||
      !enabledRef.current ||
      openingRef.current
    ) {
      return;
    }

    openingRef.current = true;
    try {
      const pendingPaths = await Backend.runtime.takePendingOpenFiles();
      const isStartupFlush = startupFlushRef.current;
      startupFlushRef.current = false;
      if (disposedRef.current || !enabledRef.current) return;
      const uniquePaths = [...new Set([...queuedPathsRef.current, ...pendingPaths].filter(Boolean))];
      queuedPathsRef.current = [];
      if (isStartupFlush && uniquePaths.length > 0) {
        setSyncScroll(true);
      }
      for (const path of uniquePaths) {
        await openFile(path);
      }
    } catch (error) {
      console.error('외부 파일 열기 실패:', error);
    } finally {
      openingRef.current = false;
      if (queuedPathsRef.current.length > 0) {
        void flushQueuedPaths();
      }
    }
  }, [openFile, setSyncScroll]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled) {
      void flushQueuedPaths();
    }
  }, [enabled, flushQueuedPaths]);

  useEffect(() => {
    if (!Backend.runtime.isTauriRuntime() || !currentPlatformCapabilities().has('externalFile.open')) return;

    disposedRef.current = false;
    let unlisten: (() => void) | null = null;

    void Backend.runtime
      .listenExternalOpenFiles((paths) => {
        queuedPathsRef.current.push(...paths);
        void flushQueuedPaths();
      })
      .then(async (nextUnlisten) => {
        unlisten = nextUnlisten;
        await flushQueuedPaths();
      })
      .catch((error) => {
        console.error('외부 파일 열기 이벤트 연결 실패:', error);
      });

    const flushOnFocus = () => {
      void flushQueuedPaths();
    };
    const flushOnVisible = () => {
      if (document.visibilityState === 'visible') {
        void flushQueuedPaths();
      }
    };

    window.addEventListener('focus', flushOnFocus);
    document.addEventListener('visibilitychange', flushOnVisible);

    return () => {
      disposedRef.current = true;
      unlisten?.();
      window.removeEventListener('focus', flushOnFocus);
      document.removeEventListener('visibilitychange', flushOnVisible);
    };
  }, [flushQueuedPaths]);
}
