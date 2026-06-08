import { useEffect, useMemo, useRef } from 'react';
import { EditorPane } from './components/editor/EditorPane';
import { PreviewPane } from './components/preview/PreviewPane';
import { AppShell } from './components/shell/AppShell';
import { createCommandRegistry, dispatchCommand } from './app/commands';
import { enabledFeatures } from './app/featureRegistry';
import { Sidebar } from './components/sidebar/Sidebar';
import { useExternalFileOpen } from './hooks/useExternalFileOpen';
import { useNativeMenuCommands } from './hooks/useNativeMenuCommands';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useResponsiveSplitWidth } from './hooks/useResponsiveSplitWidth';
import { useShortcuts } from './hooks/useShortcuts';
import { useScrollSync } from './hooks/useScrollSync';
import { useWindowSizeConstraints } from './hooks/useWindowSizeConstraints';
import { useSearchStore } from './features/search';
import { useUIStore } from './store/ui';
import { isDirty, selectActiveFile, useWorkspaceStore } from './store/workspace';

export function App() {
  const bodyRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const openFileCount = useWorkspaceStore((state) => state.openFiles.length);
  const nextRecentPath = useWorkspaceStore((state) => state.recentFiles[0]?.path ?? null);
  const openFolder = useWorkspaceStore((state) => state.openFolder);
  const createFile = useWorkspaceStore((state) => state.createFile);
  const saveActive = useWorkspaceStore((state) => state.saveActive);
  const saveActiveAs = useWorkspaceStore((state) => state.saveActiveAs);
  const closeFile = useWorkspaceStore((state) => state.closeFile);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const openFind = useSearchStore((state) => state.openFind);
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const viewMode = useUIStore((state) => state.viewMode);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const editorWidth = useUIStore((state) => state.editorWidth);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
  const setEditorWidth = useUIStore((state) => state.setEditorWidth);
  const openingRecentFileRef = useRef(false);

  const commandRegistry = useMemo(
    () =>
      createCommandRegistry(enabledFeatures, {
        search: { openFind },
      }),
    [openFind],
  );

  const shortcuts = useMemo(
    () => ({
      onNewFile: () => void createFile(),
      onOpen: () => void openFile(),
      onOpenFolder: () => void openFolder(),
      onSave: () => void saveActive(),
      onSaveAs: () => void saveActiveAs(),
      onExportPdf: () => dispatchCommand(commandRegistry, 'pdf.exportCurrent'),
      onClose: () => {
        if (!activeFile) return;
        if (isDirty(activeFile) && !window.confirm(`${activeFile.name} 파일의 저장되지 않은 변경사항을 버리고 닫을까요?`)) return;
        closeFile(activeFile.id);
      },
    }),
    [activeFile, closeFile, commandRegistry, createFile, openFile, openFolder, saveActive, saveActiveAs],
  );

  useShortcuts(shortcuts, commandRegistry);
  useNativeMenuCommands(shortcuts);
  const sessionLoaded = useSessionPersistence();
  useExternalFileOpen(openFile, sessionLoaded);
  useEffect(() => {
    if (!sessionLoaded || openFileCount > 0 || !nextRecentPath || openingRecentFileRef.current) return;

    openingRecentFileRef.current = true;
    void openFile(nextRecentPath)
      .catch((error) => {
        console.error('최근 파일 자동 열기 실패:', error);
      })
      .finally(() => {
        openingRecentFileRef.current = false;
      });
  }, [nextRecentPath, openFile, openFileCount, sessionLoaded]);
  useScrollSync(editorRef, previewRef, syncScroll && viewMode === 'split');
  useResponsiveSplitWidth(bodyRef, viewMode, sidebarMode, sidebarWidth, editorWidth);
  useWindowSizeConstraints(viewMode, sidebarMode, sidebarWidth);

  const startSidebarResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!body || sidebarMode === 'collapsed') return;
    event.preventDefault();
    const app = body.closest<HTMLElement>('.app');
    const rect = body.getBoundingClientRect();
    let nextWidth = sidebarWidth;

    beginHorizontalDrag({
      onMove: (clientX) => {
        nextWidth = clamp(clientX - rect.left, 180, 420);
        app?.style.setProperty('--sidebar-w', `${nextWidth}px`);
      },
      onEnd: () => setSidebarWidth(nextWidth),
    });
  };

  const startSplitResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!body || viewMode !== 'split') return;
    event.preventDefault();
    const app = body.closest<HTMLElement>('.app');
    const rect = body.getBoundingClientRect();
    const sidebarHandleWidth = sidebarMode === 'collapsed' ? 0 : 6;
    const splitHandleWidth = 6;
    const activeSidebarWidth = sidebarMode === 'collapsed' ? 56 : sidebarWidth;
    const maxEditorWidth = Math.max(280, rect.width - activeSidebarWidth - sidebarHandleWidth - splitHandleWidth - 280);
    let nextWidth = clamp(editorWidth, 280, maxEditorWidth);

    beginHorizontalDrag({
      onMove: (clientX) => {
        const rawWidth = clientX - rect.left - activeSidebarWidth - sidebarHandleWidth - splitHandleWidth / 2;
        nextWidth = clamp(rawWidth, 280, maxEditorWidth);
        app?.style.setProperty('--editor-w', `${nextWidth}px`);
        app?.style.setProperty('--effective-editor-w', `${nextWidth}px`);
      },
      onEnd: () => setEditorWidth(nextWidth),
    });
  };

  return (
    <AppShell menuHandlers={shortcuts} commandRegistry={commandRegistry}>
      <main className="body" ref={bodyRef}>
        <Sidebar textareaRef={editorRef} />
        <PaneResizer hidden={sidebarMode === 'collapsed'} label="사이드바 크기 조절" onPointerDown={startSidebarResize} />
        <EditorPane textareaRef={editorRef} commandRegistry={commandRegistry} />
        <PaneResizer hidden={viewMode !== 'split'} label="편집 구역 크기 조절" onPointerDown={startSplitResize} />
        <PreviewPane previewRef={previewRef} />
      </main>
    </AppShell>
  );
}

function PaneResizer({
  hidden,
  label,
  onPointerDown,
}: {
  hidden: boolean;
  label: string;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      aria-hidden={hidden}
      aria-label={label}
      className={`pane-resizer ${hidden ? 'hidden' : ''}`}
      role="separator"
      onPointerDown={onPointerDown}
    />
  );
}

function beginHorizontalDrag({
  onMove,
  onEnd,
}: {
  onMove: (clientX: number) => void;
  onEnd: () => void;
}): void {
  let animationFrame = 0;
  let latestClientX: number | null = null;
  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  const flush = () => {
    animationFrame = 0;
    if (latestClientX === null) return;
    onMove(latestClientX);
  };
  const onPointerMove = (event: PointerEvent) => {
    latestClientX = event.clientX;
    if (animationFrame) return;
    animationFrame = window.requestAnimationFrame(flush);
  };
  const stop = () => {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      flush();
    }
    window.removeEventListener('pointermove', onPointerMove);
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
    onEnd();
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', stop, { once: true });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
