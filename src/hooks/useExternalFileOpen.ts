import { useEffect } from 'react';
import { takePendingOpenFiles } from '../lib/tauri/fs';
import { isTauriRuntime } from '../lib/tauri/invoke';

const externalOpenEvent = 'saekim-open-external-files';

export function useExternalFileOpen(openFile: (path: string) => Promise<void>, enabled: boolean): void {
  useEffect(() => {
    if (!isTauriRuntime() || !enabled) return;

    let disposed = false;
    let unlisten: (() => void) | null = null;

    const openPaths = async (paths: string[]) => {
      const uniquePaths = [...new Set(paths.filter(Boolean))];
      for (const path of uniquePaths) {
        await openFile(path);
      }
    };

    const drainPendingOpenFiles = async (extraPaths: string[] = []) => {
      try {
        const pendingPaths = await takePendingOpenFiles();
        if (disposed) return;
        await openPaths([...extraPaths, ...pendingPaths]);
      } catch (error) {
        console.error('외부 파일 열기 실패:', error);
      }
    };

    void import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        unlisten = await listen<string[]>(externalOpenEvent, (event) => {
          void drainPendingOpenFiles(event.payload);
        });
        await drainPendingOpenFiles();
      })
      .catch((error) => {
        console.error('외부 파일 열기 이벤트 연결 실패:', error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [enabled, openFile]);
}
