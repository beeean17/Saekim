import { useCallback, useEffect, useRef } from 'react';
import { isTauriRuntime } from '../lib/tauri/invoke';

const supportedDocumentExtensions = new Set(['md', 'markdown', 'mdown', 'mkd', 'txt']);

export function useFileDropOpen(openFile: (path: string) => Promise<void>, enabled: boolean): void {
  const openingRef = useRef(false);
  const queuedPathsRef = useRef<string[]>([]);
  const enabledRef = useRef(enabled);

  const flushDroppedPaths = useCallback(async () => {
    if (!isTauriRuntime() || !enabledRef.current || openingRef.current) return;

    const paths = [...new Set(queuedPathsRef.current.filter(isSupportedDocumentPath))];
    queuedPathsRef.current = [];
    if (paths.length === 0) return;

    openingRef.current = true;
    try {
      for (const path of paths) {
        await openFile(path);
      }
    } catch (error) {
      console.error('드래그 앤 드롭 파일 열기 실패:', error);
    } finally {
      openingRef.current = false;
      if (queuedPathsRef.current.length > 0) {
        void flushDroppedPaths();
      }
    }
  }, [openFile]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled) {
      void flushDroppedPaths();
    }
  }, [enabled, flushDroppedPaths]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlisten: (() => void) | null = null;
    void import('@tauri-apps/api/webview')
      .then(async ({ getCurrentWebview }) => {
        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type !== 'drop') return;
          queuedPathsRef.current.push(...event.payload.paths);
          void flushDroppedPaths();
        });
      })
      .catch((error) => {
        console.error('드래그 앤 드롭 이벤트 연결 실패:', error);
      });

    return () => {
      unlisten?.();
    };
  }, [flushDroppedPaths]);
}

function isSupportedDocumentPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop() ?? '';
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
  return Boolean(extension && supportedDocumentExtensions.has(extension));
}
