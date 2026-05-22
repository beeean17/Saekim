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

    let unlisten: (() => void) | null = null;
    void import('@tauri-apps/api/webview')
      .then(async ({ getCurrentWebview }) => {
        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type !== 'drop') return;
          queuePaths(event.payload.paths);
        });
      })
      .catch((error) => {
        console.error('드래그 앤 드롭 이벤트 연결 실패:', error);
      });

    return () => {
      unlisten?.();
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

    return () => {
      window.removeEventListener('dragover', preventDefaultDrop, true);
      window.removeEventListener('drop', openDroppedFiles, true);
    };
  }, [queuePaths]);
}

function isSupportedDocumentPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop() ?? '';
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
  return Boolean(extension && supportedDocumentExtensions.has(extension));
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
