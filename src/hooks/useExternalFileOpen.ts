import { useCallback, useEffect, useRef } from 'react';
import { takePendingOpenFiles } from '../lib/tauri/fs';
import { Backend } from '../platform/common/backend';
import { currentPlatformCapabilities } from '../platform/common/capabilities';

const externalOpenEvent = 'saekim-open-external-files';

export function useExternalFileOpen(openFile: (path: string) => Promise<void>, enabled: boolean): void {
  const enabledRef = useRef(enabled);
  const queuedPathsRef = useRef<string[]>([]);
  const openingRef = useRef(false);
  const disposedRef = useRef(false);

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
      const pendingPaths = await takePendingOpenFiles();
      if (disposedRef.current || !enabledRef.current) return;
      const uniquePaths = [...new Set([...queuedPathsRef.current, ...pendingPaths].filter(Boolean))];
      queuedPathsRef.current = [];
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
  }, [openFile]);

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
    let unlistenWindow: (() => void) | null = null;

    void import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        unlisten = await listen<string[]>(externalOpenEvent, (event) => {
          queuedPathsRef.current.push(...event.payload);
          void flushQueuedPaths();
        });
        await flushQueuedPaths();
      })
      .catch((error) => {
        console.error('외부 파일 열기 이벤트 연결 실패:', error);
      });

    void import('@tauri-apps/api/window')
      .then(async ({ getCurrentWindow }) => {
        unlistenWindow = await getCurrentWindow().listen<string[]>(externalOpenEvent, (event) => {
          queuedPathsRef.current.push(...event.payload);
          void flushQueuedPaths();
        });
      })
      .catch((error) => {
        console.error('외부 파일 열기 창 이벤트 연결 실패:', error);
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
    const pendingPoll = window.setInterval(() => {
      if (enabledRef.current) {
        void flushQueuedPaths();
      }
    }, 1500);

    return () => {
      disposedRef.current = true;
      unlisten?.();
      unlistenWindow?.();
      window.removeEventListener('focus', flushOnFocus);
      document.removeEventListener('visibilitychange', flushOnVisible);
      window.clearInterval(pendingPoll);
    };
  }, [flushQueuedPaths]);
}
