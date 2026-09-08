import { useCallback, useMemo, useRef, useState } from 'react';
import { EditorPane } from './components/editor/EditorPane';
import { PreviewPane } from './components/preview/PreviewPane';
import { AppShell } from './components/shell/AppShell';
import { createCommandRegistry, dispatchCommand } from './app/commands';
import { openProjectWebsite, showKeyboardShortcuts } from './app/help';
import { enabledFeatures } from './app/featureRegistry';
import { Sidebar } from './components/sidebar/Sidebar';
import { useExternalFileOpen } from './hooks/useExternalFileOpen';
import { useCloseProtection } from './hooks/useCloseProtection';
import { useNativeMenuCommands } from './hooks/useNativeMenuCommands';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useResponsiveSplitWidth } from './hooks/useResponsiveSplitWidth';
import { useResponsiveViewMode } from './hooks/useResponsiveViewMode';
import { usePaneResizers } from './hooks/usePaneResizers';
import { useShortcuts } from './hooks/useShortcuts';
import { useScrollSync } from './hooks/useScrollSync';
import { useWindowSizeConstraints } from './hooks/useWindowSizeConstraints';
import { useAutoUpdater } from './hooks/useAutoUpdater';
import { useWindowDocumentState } from './hooks/useWindowDocumentState';
import { useSearchStore } from './features/search';
import { useCommandPaletteStore } from './features/command-palette';
import { useVersionHistoryStore } from './features/version-history';
import { toggleInlineMarker } from './core/editor/textEditing';
import { Backend } from './platform/common/backend';
import { useUIStore } from './store/ui';
import { defaultEditorFontSize, stepFontSize, useSettingsStore } from './store/settings';
import { selectActiveFile, useWorkspaceStore } from './store/workspace';
import type { ViewMode } from './types/workspace';
import { useI18n } from './i18n/useI18n';

export function App() {
  const { language, t } = useI18n();
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
  const activeFile = useWorkspaceStore(selectActiveFile);
  const closeActiveFile = useCloseProtection();
  const openFind = useSearchStore((state) => state.openFind);
  const openReplace = useSearchStore((state) => state.openReplace);
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const viewMode = useUIStore((state) => state.viewMode);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const editorWidth = useUIStore((state) => state.editorWidth);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
  const setSidebarMode = useUIStore((state) => state.setSidebarMode);
  const setEditorWidth = useUIStore((state) => state.setEditorWidth);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const openSettings = useUIStore((state) => state.openSettings);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const openCommandPalette = useCommandPaletteStore((state) => state.open);
  const openVersionHistory = useVersionHistoryStore((state) => state.open);
  const zoomIn = useCallback(() => {
    const settings = useSettingsStore.getState();
    settings.setFontSize(stepFontSize(settings.fontSize, 1));
  }, []);
  const zoomOut = useCallback(() => {
    const settings = useSettingsStore.getState();
    settings.setFontSize(stepFontSize(settings.fontSize, -1));
  }, []);
  const resetZoom = useCallback(() => useSettingsStore.getState().setFontSize(defaultEditorFontSize), []);
  const { viewportProfile, availableViewModes, effectiveViewMode } = useResponsiveViewMode(viewMode);

  const commandRegistry = useMemo(
    () =>
      createCommandRegistry(enabledFeatures, {
        file: {
          newFile: () => void createFile(),
          openFile: () => void openFile(),
          openFolder: () => void openFolder(),
          save: () => void saveActive(),
          saveAs: () => void saveActiveAs(),
          print: () => window.print(),
          close: () => void closeActiveFile(),
        },
        window: {
          newWindow: () => void Backend.runtime.openNewWindow(),
          close: () => void Backend.runtime.runWindowAction('close'),
        },
        editor: {
          hasTarget: () => Boolean(editorRef.current),
          toggleBold: () => toggleInlineMarker(editorRef.current, '**'),
          toggleItalic: () => toggleInlineMarker(editorRef.current, '*'),
        },
        view: {
          openSettings,
          setMode: setViewMode,
          canSetMode: (mode) => availableViewModes.includes(mode),
          toggleSidebar,
          zoomIn,
          zoomOut,
          resetZoom,
        },
        search: { openFind, openReplace },
        palette: { open: openCommandPalette },
        history: {
          hasDocument: () => Boolean(useWorkspaceStore.getState().activeFileId),
          open: openVersionHistory,
        },
      }),
    [
      availableViewModes,
      closeActiveFile,
      createFile,
      openCommandPalette,
      openFile,
      openFind,
      openFolder,
      openReplace,
      openSettings,
      openVersionHistory,
      saveActive,
      saveActiveAs,
      setViewMode,
      toggleSidebar,
      zoomIn,
      zoomOut,
      resetZoom,
      language,
    ],
  );

  const nativeMenuHandlers = useMemo(
    () => ({
      onNewFile: () => dispatchCommand(commandRegistry, 'file.new'),
      onNewWindow: () => dispatchCommand(commandRegistry, 'window.new'),
      onOpen: () => dispatchCommand(commandRegistry, 'file.open'),
      onOpenFolder: () => dispatchCommand(commandRegistry, 'folder.open'),
      onOpenRecentFile: (path: string) => void openFile(path),
      onOpenRecentWorkspace: (path: string) => void openWorkspace(path),
      onSave: () => dispatchCommand(commandRegistry, 'file.save'),
      onSaveAs: () => dispatchCommand(commandRegistry, 'file.saveAs'),
      onPrint: () => dispatchCommand(commandRegistry, 'file.print'),
      onCloseFile: () => dispatchCommand(commandRegistry, 'file.close'),
      onCloseWindow: () => dispatchCommand(commandRegistry, 'window.close'),
      onExportPdf: () => dispatchCommand(commandRegistry, 'pdf.exportCurrent'),
      onOpenVersionHistory: () => dispatchCommand(commandRegistry, 'documents.openVersionHistory'),
      onFind: () => dispatchCommand(commandRegistry, 'search.openFind'),
      onReplace: () => dispatchCommand(commandRegistry, 'search.openReplace'),
      onZoomIn: () => dispatchCommand(commandRegistry, 'view.zoomIn'),
      onZoomOut: () => dispatchCommand(commandRegistry, 'view.zoomOut'),
      onZoomReset: () => dispatchCommand(commandRegistry, 'view.zoomReset'),
      onOpenGitHub: openProjectWebsite,
      onShowShortcuts: showKeyboardShortcuts,
    }),
    [commandRegistry, openFile, openWorkspace],
  );

  useShortcuts(commandRegistry);
  useNativeMenuCommands(nativeMenuHandlers);
  const sessionLoaded = useSessionPersistence();
  useExternalFileOpen(openFile, sessionLoaded);
  const handlePreviewElementChange = useCallback((element: HTMLDivElement | null) => {
    setPreviewElement(element);
  }, []);
  useScrollSync(editorRef, editorScrollRef, previewRef, syncScroll && effectiveViewMode === 'split', activeFile?.id ?? null, previewElement);
  useResponsiveSplitWidth(bodyRef, effectiveViewMode, sidebarMode, sidebarWidth, editorWidth, viewportProfile.profile);
  useWindowSizeConstraints();
  useWindowDocumentState(activeFile);
  useAutoUpdater();
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
      commandRegistry={commandRegistry}
      viewportProfile={viewportProfile}
      effectiveViewMode={effectiveViewMode}
      availableViewModes={availableViewModes}
      textareaRef={editorRef}
    >
      <main className="body" ref={bodyRef}>
        <Sidebar
          compact={viewportProfile.profile === 'compact'}
          textareaRef={editorRef}
          editorScrollRef={editorScrollRef}
          previewRef={previewRef}
          commandRegistry={commandRegistry}
          effectiveViewMode={effectiveViewMode}
        />
        <PaneResizer
          hidden={viewportProfile.profile === 'compact'}
          kind="sidebar"
          label={sidebarMode === 'collapsed' ? t('sidebar.open') : t('sidebar.resize')}
          onPointerDown={startSidebarResize}
        />
        <EditorPane editorScrollRef={editorScrollRef} textareaRef={editorRef} commandRegistry={commandRegistry} />
        <PaneResizer hidden={false} kind="pane" label={paneResizerLabel(effectiveViewMode, t)} onPointerDown={startPaneResize} />
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

function paneResizerLabel(viewMode: ViewMode, t: ReturnType<typeof useI18n>['t']): string {
  switch (viewMode) {
    case 'edit':
      return t('view.openPreview');
    case 'preview':
      return t('view.openEditor');
    case 'split':
      return t('view.resizeEditor');
  }
}
