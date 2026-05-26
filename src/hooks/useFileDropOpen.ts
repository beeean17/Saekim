import { useCallback, useEffect, useRef } from 'react';
import { isTauriRuntime } from '../lib/tauri/invoke';

export function useFileDropOpen(openFile: (path: string) => Promise<void>, enabled: boolean): void {
  const openingRef = useRef(false);
  const queuedPathsRef = useRef<string[]>([]);
  const enabledRef = useRef(enabled);
  const disposedRef = useRef(false);

  const flushDroppedPaths = useCallback(async () => {
    if (!isTauriRuntime() || !enabledRef.current || openingRef.current) return;

    const paths = [...new Set(queuedPathsRef.current.filter(Boolean))];
    queuedPathsRef.current = [];
    if (paths.length === 0) return;

    openingRef.current = true;
    try {
      for (const path of paths) {
        if (disposedRef.current || !enabledRef.current) return;
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

  const queuePaths = useCallback(
    (paths: string[]) => {
      queuedPathsRef.current.push(...paths);
      void flushDroppedPaths();
    },
    [flushDroppedPaths],
  );

  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled) {
      void flushDroppedPaths();
    }
  }, [enabled, flushDroppedPaths]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    disposedRef.current = false;
    let alive = true;
    const unlisteners: Array<() => void> = [];
    const addUnlistener = (unlisten: () => void) => {
      if (alive) {
        unlisteners.push(unlisten);
      } else {
        unlisten();
      }
    };
    const handleNativeDrop = (source: 'webview' | 'window', payload: { type: string; paths?: string[] }) => {
      logDropEvent(source, payload);
      if (payload.type !== 'drop' || !payload.paths) return;
      queuePaths(payload.paths);
    };

    void import('@tauri-apps/api/webview')
      .then(async ({ getCurrentWebview }) => {
        const unlisten = await getCurrentWebview().onDragDropEvent((event) => handleNativeDrop('webview', event.payload));
        addUnlistener(unlisten);
      })
      .catch((error) => {
        console.error('WebView 드래그 앤 드롭 이벤트 연결 실패:', error);
      });

    void import('@tauri-apps/api/window')
      .then(async ({ getCurrentWindow }) => {
        const unlisten = await getCurrentWindow().onDragDropEvent((event) => handleNativeDrop('window', event.payload));
        addUnlistener(unlisten);
      })
      .catch((error) => {
        console.error('Window 드래그 앤 드롭 이벤트 연결 실패:', error);
      });

    return () => {
      disposedRef.current = true;
      alive = false;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [queuePaths]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    const preventDefaultDrop = (event: DragEvent) => {
      event.preventDefault();
    };
    const openDroppedFiles = (event: DragEvent) => {
      event.preventDefault();
      const paths = droppedFilePaths(event.dataTransfer);
      if (paths.length > 0) {
        queuePaths(paths);
      }
    };

    window.addEventListener('dragover', preventDefaultDrop, true);
    window.addEventListener('drop', openDroppedFiles, true);
    const flushOnFocus = () => {
      void flushDroppedPaths();
    };
    const flushOnVisible = () => {
      if (document.visibilityState === 'visible') {
        void flushDroppedPaths();
      }
    };
    const pendingPoll = window.setInterval(() => {
      if (queuedPathsRef.current.length > 0 && enabledRef.current) {
        void flushDroppedPaths();
      }
    }, 1500);

    window.addEventListener('focus', flushOnFocus);
    document.addEventListener('visibilitychange', flushOnVisible);

    return () => {
      window.removeEventListener('dragover', preventDefaultDrop, true);
      window.removeEventListener('drop', openDroppedFiles, true);
      window.removeEventListener('focus', flushOnFocus);
      document.removeEventListener('visibilitychange', flushOnVisible);
      window.clearInterval(pendingPoll);
    };
  }, [flushDroppedPaths, queuePaths]);
}

function droppedFilePaths(dataTransfer: DataTransfer | null): string[] {
  if (!dataTransfer) return [];

  const filePaths = Array.from(dataTransfer.files)
    .map((file) => (file as File & { path?: string }).path)
    .filter((path): path is string => Boolean(path));

  if (filePaths.length > 0) {
    return filePaths;
  }

  return dataTransfer
    .getData('text/uri-list')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map(filePathFromUri)
    .filter((path): path is string => Boolean(path));
}

function filePathFromUri(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'file:') return null;
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

function logDropEvent(source: 'webview' | 'window', payload: { type: string; paths?: string[] }): void {
  if (!import.meta.env.DEV) return;
  console.info(`[saekim-drop:${source}]`, payload);
}
