import { useMemo, useRef } from 'react';
import { EditorPane } from './components/editor/EditorPane';
import { PreviewPane } from './components/preview/PreviewPane';
import { AppShell } from './components/shell/AppShell';
import { Sidebar } from './components/sidebar/Sidebar';
import { useNativeMenuCommands } from './hooks/useNativeMenuCommands';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useShortcuts } from './hooks/useShortcuts';
import { useScrollSync } from './hooks/useScrollSync';
import { exportPreviewToPdf } from './lib/pdf/export';
import { useUIStore } from './store/ui';
import { isDirty, selectActiveFile, useWorkspaceStore } from './store/workspace';

export function App() {
  const bodyRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const saveActive = useWorkspaceStore((state) => state.saveActive);
  const saveActiveAs = useWorkspaceStore((state) => state.saveActiveAs);
  const closeFile = useWorkspaceStore((state) => state.closeFile);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const openFind = useUIStore((state) => state.openFind);
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const viewMode = useUIStore((state) => state.viewMode);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
  const setSplitRatio = useUIStore((state) => state.setSplitRatio);

  const shortcuts = useMemo(
    () => ({
      onOpen: () => void openFile(),
      onSave: () => void saveActive(),
      onSaveAs: () => void saveActiveAs(),
      onExportPdf: () => void exportPreviewToPdf(),
      onFind: openFind,
      onClose: () => {
        if (!activeFile) return;
        if (isDirty(activeFile) && !window.confirm(`${activeFile.name} 파일의 저장되지 않은 변경사항을 버리고 닫을까요?`)) return;
        closeFile(activeFile.id);
      },
    }),
    [activeFile, closeFile, openFile, openFind, saveActive, saveActiveAs],
  );

  useShortcuts(shortcuts);
  useNativeMenuCommands(shortcuts);
  useScrollSync(editorRef, previewRef, syncScroll && viewMode === 'split');
  useSessionPersistence();

  const startSidebarResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!body || sidebarMode === 'collapsed') return;
    event.preventDefault();
    beginDrag(() => {
      const rect = body.getBoundingClientRect();
      return (nextEvent) => setSidebarWidth(nextEvent.clientX - rect.left);
    });
  };

  const startSplitResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!body || viewMode !== 'split') return;
    event.preventDefault();
    beginDrag(() => {
      const rect = body.getBoundingClientRect();
      const handleWidth = 12;
      const remainingWidth = Math.max(1, rect.width - sidebarWidth - handleWidth);
      return (nextEvent) => {
        const editorWidth = nextEvent.clientX - rect.left - sidebarWidth - handleWidth / 2;
        setSplitRatio(editorWidth / remainingWidth);
      };
    });
  };

  return (
    <AppShell>
      <main className="body" ref={bodyRef}>
        <Sidebar />
        <PaneResizer hidden={sidebarMode === 'collapsed'} label="사이드바 크기 조절" onPointerDown={startSidebarResize} />
        <EditorPane textareaRef={editorRef} />
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

function beginDrag(createMoveHandler: () => (event: PointerEvent) => void): void {
  const onMove = createMoveHandler();
  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  const stop = () => {
    window.removeEventListener('pointermove', onMove);
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', stop, { once: true });
}
