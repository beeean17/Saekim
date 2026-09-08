import { useCallback, useMemo, useRef, useState } from 'react';
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
import { useResponsiveViewMode } from './hooks/useResponsiveViewMode';
import { usePaneResizers } from './hooks/usePaneResizers';
import { useShortcuts } from './hooks/useShortcuts';
import { useScrollSync } from './hooks/useScrollSync';
import { useWindowSizeConstraints } from './hooks/useWindowSizeConstraints';
import { useSearchStore } from './features/search';
import { Backend } from './platform/common/backend';
import { useUIStore } from './store/ui';
import { isDirty, selectActiveFile, useWorkspaceStore } from './store/workspace';
import type { ViewMode } from './types/workspace';

export function App() {
  const bodyRef = useRef<HTMLElement | null>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(null);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const openFolder = useWorkspaceStore((state) => state.openFolder);
  const openWorkspace = useWorkspaceStore((state) => state.openWorkspace);
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
  const setSidebarMode = useUIStore((state) => state.setSidebarMode);
  const setEditorWidth = useUIStore((state) => state.setEditorWidth);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const { viewportProfile, availableViewModes, effectiveViewMode } = useResponsiveViewMode(viewMode);

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
      onNewWindow: () => void Backend.runtime.openNewWindow(),
      onOpen: () => void openFile(),
      onOpenFolder: () => void openFolder(),
      onOpenRecentWorkspace: (path: string) => void openWorkspace(path),
      onSave: () => void saveActive(),
      onSaveAs: () => void saveActiveAs(),
      onCloseFile: () => {
        if (!activeFile) {
          void Backend.runtime.runWindowAction('close');
          return;
        }
        if (isDirty(activeFile) && !window.confirm(`저장하지 않은 ${activeFile.name} 파일을 닫을까요?`)) return;
        closeFile(activeFile.id);
      },
      onCloseWindow: () => void Backend.runtime.runWindowAction('close'),
      onExportPdf: () => dispatchCommand(commandRegistry, 'pdf.exportCurrent'),
    }),
    [activeFile, closeFile, commandRegistry, createFile, openFile, openFolder, openWorkspace, saveActive, saveActiveAs],
  );

  useShortcuts(shortcuts, commandRegistry);
  useNativeMenuCommands(shortcuts);
  const sessionLoaded = useSessionPersistence();
  useExternalFileOpen(openFile, sessionLoaded);
  const handlePreviewElementChange = useCallback((element: HTMLDivElement | null) => {
    setPreviewElement(element);
  }, []);
  useScrollSync(editorRef, editorScrollRef, previewRef, syncScroll && effectiveViewMode === 'split', activeFile?.id ?? null, previewElement);
  useResponsiveSplitWidth(bodyRef, effectiveViewMode, sidebarMode, sidebarWidth, editorWidth, viewportProfile.profile);
  useWindowSizeConstraints(effectiveViewMode, sidebarMode, sidebarWidth);
  const { startSidebarResize, startPaneResize } = usePaneResizers({
    bodyRef,
    sidebarMode,
    sidebarWidth,
    editorWidth,
    effectiveViewMode,
    viewportProfile: viewportProfile.profile,
    setSidebarMode,
    setSidebarWidth,
    setEditorWidth,
    setViewMode,
  });

  return (
    <AppShell
      menuHandlers={shortcuts}
      commandRegistry={commandRegistry}
      viewportProfile={viewportProfile}
      effectiveViewMode={effectiveViewMode}
      availableViewModes={availableViewModes}
      textareaRef={editorRef}
    >
      <main className="body" ref={bodyRef}>
        <Sidebar
          textareaRef={editorRef}
          menuHandlers={shortcuts}
          commandRegistry={commandRegistry}
          effectiveViewMode={effectiveViewMode}
          availableViewModes={availableViewModes}
        />
        <PaneResizer
          hidden={viewportProfile.profile === 'compact'}
          kind="sidebar"
          label={sidebarMode === 'collapsed' ? '사이드바 열기' : '사이드바 크기 조절'}
          onPointerDown={startSidebarResize}
        />
        <EditorPane editorScrollRef={editorScrollRef} textareaRef={editorRef} commandRegistry={commandRegistry} />
        <PaneResizer hidden={false} kind="pane" label={paneResizerLabel(effectiveViewMode)} onPointerDown={startPaneResize} />
        <PreviewPane previewRef={previewRef} onPreviewElementChange={handlePreviewElementChange} />
      </main>
    </AppShell>
  );
}

function PaneResizer({
  hidden,
  kind,
  label,
  onPointerDown,
}: {
  hidden: boolean;
  kind: 'pane' | 'sidebar';
  label: string;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      aria-hidden={hidden}
      aria-label={label}
      className={`pane-resizer pane-resizer-${kind} ${hidden ? 'hidden' : ''}`}
      role="separator"
      onPointerDown={onPointerDown}
    />
  );
}

function paneResizerLabel(viewMode: ViewMode): string {
  switch (viewMode) {
    case 'edit':
      return '미리보기 열기';
    case 'preview':
      return '편집기 열기';
    case 'split':
      return '편집 구역 크기 조절';
  }
}
