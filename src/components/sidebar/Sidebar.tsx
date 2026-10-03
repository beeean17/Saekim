import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject, type TouchEvent } from 'react';
import { dispatchCommand, formatShortcut, type CommandRegistry } from '../../app/commands';
import { enabledFeatures } from '../../app/featureRegistry';
import { relativeTime } from '../../core/format/relativeTime';
import { selectSidebarContributions } from '../../core/sidebar/registry';
import { Backend } from '../../platform/common/backend';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';
import { Platform } from '../../platform/common/platform';
import { isDirty, selectActiveFile, useWorkspaceStore, type PendingFileCreation } from '../../store/workspace';
import { useUIStore } from '../../store/ui';
import type { FileTreeNode, OpenFile, ViewMode, WorkspaceSearchItem } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';
import { Dialog, DialogActions } from '../ui/overlay/Dialog';
import { Button } from '../ui/primitives/Button';
import { EmptyState } from '../ui/feedback/EmptyState';
import { CloseButton } from '../ui/primitives/CloseButton';
import { SearchField } from '../ui/primitives/SearchField';
import { SidebarMenu } from './SidebarMenu';
import { SidebarToggle } from './SidebarToggle';
import { TreeContextMenu, type TreeMenuPosition } from './TreeContextMenu';
import { useI18n } from '../../i18n/useI18n';
import { notify, notifyError } from '../../core/notifications';
import { requestConfirmation } from '../../core/dialogs/confirm';
import { ImagePreviewModal, insertImageSnippetIntoDocument } from './ImagePreviewModal';
import {
  androidContentWorkspaceDisplayName,
  androidDocumentIdDisplayName,
  androidTreeDocumentId,
  appendBlockSnippet,
  displayWorkspacePath,
  errorMessage,
  escapeMarkdownAlt,
  escapeMarkdownDestination,
  fileNameFromPath,
  isContentUriPath,
  isPathInsideWorkspaceEntry,
  isPlaceholderDocumentPath,
  isWorkspaceImageAsset,
  localImagePreviewSrc,
  markdownImagePathForContentDocument,
  markdownImagePathForDocument,
  markdownImageSnippet,
  normalizePath,
  parentContentDocumentId,
  parentFolderFromPath,
  parentFolderPath,
  parseContentTreeDocumentUri,
  pathParts,
  pathRoot,
  relativePath,
} from './sidebarPaths';

interface SidebarProps {
  compact: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
  editorScrollRef: RefObject<HTMLDivElement>;
  previewRef: RefObject<HTMLDivElement>;
  commandRegistry: CommandRegistry;
  effectiveViewMode: ViewMode;
}

export function Sidebar({
  compact,
  textareaRef,
  editorScrollRef,
  previewRef,
  commandRegistry,
  effectiveViewMode,
}: SidebarProps) {
  const { t } = useI18n();
  const sidebarRef = useRef<HTMLElement | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const compactSidebarOpen = useUIStore((state) => state.compactSidebarOpen);
  const closeCompactSidebar = useUIStore((state) => state.closeCompactSidebar);
  const rootPath = useWorkspaceStore((state) => state.rootPath);
  const tree = useWorkspaceStore((state) => state.tree);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const openFolder = useWorkspaceStore((state) => state.openFolder);
  const createFile = useWorkspaceStore((state) => state.createFile);
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const selectedFolderPath = useWorkspaceStore((state) => state.selectedFolderPath);
  const pendingFileCreation = useWorkspaceStore((state) => state.pendingFileCreation);
  const pendingFolderCreation = useWorkspaceStore((state) => state.pendingFolderCreation);
  const commitFileCreation = useWorkspaceStore((state) => state.commitFileCreation);
  const cancelFileCreation = useWorkspaceStore((state) => state.cancelFileCreation);
  const cancelFolderCreation = useWorkspaceStore((state) => state.cancelFolderCreation);
  const toggleFolder = useWorkspaceStore((state) => state.toggleFolder);
  const updateContent = useWorkspaceStore((state) => state.updateContent);
  const saveFile = useWorkspaceStore((state) => state.saveFile);
  const renameWorkspaceEntry = useWorkspaceStore((state) => state.renameWorkspaceEntry);
  const removeWorkspaceEntry = useWorkspaceStore((state) => state.removeWorkspaceEntry);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const refreshFolder = useWorkspaceStore((state) => state.refreshFolder);
  const fileOperationsAvailable = currentPlatformCapabilities().has('folder.operations');
  const sidebarContributions = useMemo(() => selectSidebarContributions(enabledFeatures), []);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState('explorer');
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = useState(false);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
  const [workspaceSearchResults, setWorkspaceSearchResults] = useState<WorkspaceSearchItem[] | null>(null);
  const [workspaceSearchError, setWorkspaceSearchError] = useState<string | null>(null);
  const [workspaceSearchNeedsFolder, setWorkspaceSearchNeedsFolder] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ path: string; name: string } | null>(null);
  const [treeMenu, setTreeMenu] = useState<{ node: FileTreeNode; position: TreeMenuPosition } | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileTreeNode | null>(null);
  const closeSearch = () => {
    setWorkspaceSearchQuery('');
    setWorkspaceSearchOpen(false);
  };
  const searchNeedle = workspaceSearchQuery.trim();

  useEffect(() => {
    if (!pendingFileCreation) return;
    setActiveSidebarPanel('explorer');
    setWorkspaceSearchOpen(false);
    setWorkspaceSearchQuery('');
  }, [pendingFileCreation]);

  useEffect(() => {
    if (!compact && compactSidebarOpen) closeCompactSidebar();
  }, [closeCompactSidebar, compact, compactSidebarOpen]);

  useEffect(() => {
    if (!compact || !compactSidebarOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      sidebarFocusableElements(sidebarRef.current)[0]?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCompactSidebar();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = sidebarFocusableElements(sidebarRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [closeCompactSidebar, compact, compactSidebarOpen]);

  const handleDrawerTouchStart = (event: TouchEvent<HTMLElement>) => {
    swipeStartXRef.current = event.touches[0]?.clientX ?? null;
  };
  const handleDrawerTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const startX = swipeStartXRef.current;
    swipeStartXRef.current = null;
    const endX = event.changedTouches[0]?.clientX;
    if (startX !== null && endX !== undefined && startX - endX >= 64) closeCompactSidebar();
  };

  const refreshAfterOperation = async (parentPath?: string) => {
    try {
      if (parentPath) await refreshFolder(parentPath);
      else await refresh();
    } catch (error) {
      reportFileOperationError(error, t('sidebar.fileActionFailed', { message: errorMessage(error) }));
    }
  };
  const renameEntry = async (node: FileTreeNode, nextName: string) => {
    const normalizedName = nextName.trim();
    if (!normalizedName) return;
    if (normalizedName === node.name) {
      setRenameTarget(null);
      return;
    }
    try {
      const nextPath = await Backend.folders.renameEntry(node.path, normalizedName);
      renameWorkspaceEntry(node.path, nextPath);
      setRenameTarget(null);
      await refreshAfterOperation(parentFolderPath(node.path));
    } catch (error) {
      throw new Error(t('sidebar.fileActionFailed', { message: errorMessage(error) }));
    }
  };
  const commitFolderCreation = async (name: string) => {
    const pending = useWorkspaceStore.getState().pendingFolderCreation;
    if (!pending || !name.trim()) return;
    try {
      await Backend.folders.createFolder(pending.parentPath, name.trim());
      cancelFolderCreation();
      await refreshAfterOperation(pending.parentPath);
    } catch (error) {
      throw new Error(t('sidebar.fileActionFailed', { message: errorMessage(error) }));
    }
  };
  const duplicateFile = async (node: FileTreeNode) => {
    try {
      await Backend.folders.duplicateFile(node.path);
      await refreshAfterOperation();
    } catch (error) {
      reportFileOperationError(error, t('sidebar.fileActionFailed', { message: errorMessage(error) }));
    }
  };
  const trashEntry = async (node: FileTreeNode) => {
    const confirmed = await requestConfirmation({
      title: t('sidebar.moveToTrash'),
      message: t('sidebar.trashConfirm', { name: node.name }),
      confirmLabel: t('sidebar.moveToTrash'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    });
    if (!confirmed) return;
    const affectedFiles = openFiles.filter((file) => isPathInsideWorkspaceEntry(file.path, node.path));
    const dirtyFiles = affectedFiles.filter((file) => isDirty(file));
    if (dirtyFiles.length > 0) {
      const decision = await Backend.runtime.confirmUnsavedChanges(dirtyFiles.map((file) => file.name));
      if (decision === 'cancel') return;
      if (decision === 'save') {
        for (const file of dirtyFiles) {
          const savedPath = await saveFile(file.id);
          if (!savedPath) return;
        }
      }
    }
    try {
      await Backend.folders.trashEntry(node.path);
      removeWorkspaceEntry(node.path, affectedFiles.map((file) => file.id));
      await refreshAfterOperation();
    } catch (error) {
      reportFileOperationError(error, t('sidebar.fileActionFailed', { message: errorMessage(error) }));
    }
  };

  useEffect(() => {
    if (!searchNeedle) {
      setWorkspaceSearchResults(null);
      setWorkspaceSearchError(null);
      return;
    }
    if (!rootPath || rootPath.startsWith('~')) {
      /* There is nothing to search yet; saying "no matches" would imply the
         search ran and came back empty. */
      setWorkspaceSearchResults([]);
      setWorkspaceSearchError(null);
      setWorkspaceSearchNeedsFolder(true);
      return;
    }
    setWorkspaceSearchNeedsFolder(false);

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const items: WorkspaceSearchItem[] = [];
          let cursor: string | null = null;
          do {
            const page = await Backend.folders.searchWorkspace({
              rootPath,
              query: searchNeedle,
              scope: 'file-name',
              cursor,
              limit: 200,
            });
            if (cancelled) return;
            items.push(...page.items);
            const nextCursor = page.nextCursor ?? null;
            if (nextCursor === cursor) break;
            cursor = nextCursor;
          } while (cursor);

          if (!cancelled) {
            setWorkspaceSearchResults(items);
            setWorkspaceSearchError(null);
          }
        } catch (error) {
          if (!cancelled) {
            setWorkspaceSearchResults([]);
            setWorkspaceSearchError(error instanceof Error ? error.message : String(error));
          }
        }
      })();
    }, 150);

    setWorkspaceSearchResults(null);
    setWorkspaceSearchError(null);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [rootPath, searchNeedle]);
  const addImageToDocument = (image: { path: string; name: string }) => {
    if (!activeFile) {
      notify(t('sidebar.addImageFirst'), { tone: 'warning' });
      return;
    }

    const imagePath = markdownImagePathForDocument(image.path, activeFile.path);
    insertImageSnippetIntoDocument(textareaRef.current, activeFile, updateContent, markdownImageSnippet(imagePath, image.name, t('image.defaultAlt')));
    setImagePreview(null);
  };
  const commitPendingFile = async (name: string, focusEditor: boolean) => {
    const path = await commitFileCreation(name);
    if (path && focusEditor) {
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  return (
    <>
      {compact && compactSidebarOpen ? (
        <button
          aria-label={t('sidebar.closeExplorer')}
          className="sidebar-drawer-backdrop"
          tabIndex={-1}
          type="button"
          onClick={closeCompactSidebar}
        />
      ) : null}
    <aside
      aria-label={t('sidebar.fileExplorer')}
      aria-modal={compactSidebarOpen && compact ? true : undefined}
      className="sidebar"
      id="saekim-sidebar"
      ref={sidebarRef}
      role={compactSidebarOpen && compact ? 'dialog' : undefined}
      onTouchEnd={handleDrawerTouchEnd}
      onTouchStart={handleDrawerTouchStart}
    >
      <div className="sidebar-head">
        <div className="sidebar-head-icons">
          <SidebarToggle compact={compact} />
          <div className="sidebar-actions">
            <SidebarMenu
              textareaRef={textareaRef}
              commandRegistry={commandRegistry}
              effectiveViewMode={effectiveViewMode}
            />
            <IconButton
              disabled={!rootPath || rootPath.startsWith('~')}
              label={`${t('sidebar.refresh')} (${formatShortcut('mod+r')})`}
              onClick={() => dispatchCommand(commandRegistry, 'workspace.refresh')}
            >
              <Icon name="refresh" />
            </IconButton>
          </div>
        </div>
      </div>
      <SidebarPanelTabs
        activeId={activeSidebarPanel}
        contributions={sidebarContributions}
        onSelect={(id) => {
          setTreeMenu(null);
          setActiveSidebarPanel(id);
        }}
      />
      {activeSidebarPanel === 'explorer' ? (
        <>
          <FolderPath
            path={rootPath}
            onOpenFolder={
              currentPlatformCapabilities().has('folder.open') ? () => void openFolder() : null
            }
            onSearch={() => setWorkspaceSearchOpen((open) => !open)}
          />
          {workspaceSearchOpen ? (
            <SearchField
              autoFocus
              className="sidebar-search"
              label={t('sidebar.searchPlaceholder')}
              value={workspaceSearchQuery}
              placeholder={t('sidebar.searchPlaceholder')}
              onChange={setWorkspaceSearchQuery}
              onEscape={closeSearch}
            />
          ) : null}
          <div className="file-tree">
            {searchNeedle ? (
              <WorkspaceSearchResults
                activePath={activeFile?.path ?? null}
                needsFolder={workspaceSearchNeedsFolder}
                error={workspaceSearchError}
                items={workspaceSearchResults}
                openFiles={openFiles}
                onOpen={(path) => void openFile(path)}
                onPreviewImage={(item) => setImagePreview({ path: item.path, name: item.name })}
              />
            ) : (
              <>
                {pendingFileCreation && pendingFileCreation.parentPath === rootPath ? (
                  <PendingFileInput
                    key={pendingFileCreation.id}
                    pending={pendingFileCreation}
                    onCancel={cancelFileCreation}
                    onCommit={commitPendingFile}
                  />
                ) : null}
                {!rootPath && !pendingFileCreation ? (
                  <EmptyState
                    className="sidebar-empty-state"
                    title={t('sidebar.noFolder')}
                    description={t('sidebar.noFolderDescription')}
                    actions={
                      currentPlatformCapabilities().has('folder.open') ? (
                        <Button
                          className="empty-document-action"
                          variant="primary"
                          onClick={() => void openFolder()}
                        >
                          {t('sidebar.openFolderAction')}
                        </Button>
                      ) : null
                    }
                  />
                ) : null}
                {tree.map((node) => (
                  <FileTreeNodeView
                    activePath={activeFile?.path ?? null}
                    key={node.id}
                    node={node}
                    openFiles={openFiles}
                    pendingFileCreation={pendingFileCreation}
                    renameTargetPath={renameTarget?.path ?? null}
                    selectedFolderPath={selectedFolderPath}
                    onCancelFileCreation={cancelFileCreation}
                    onCancelRename={() => setRenameTarget(null)}
                    onCommitFileCreation={commitPendingFile}
                    onCommitRename={renameEntry}
                    onToggle={toggleFolder}
                    onOpen={(path) => void openFile(path)}
                    onPreviewImage={(node) => setImagePreview({ path: node.path, name: node.name })}
                    contextTargetPath={treeMenu?.node.path ?? null}
                    onContextMenu={fileOperationsAvailable ? (node, position) => setTreeMenu({ node, position }) : undefined}
                  />
                ))}
              </>
            )}
          </div>
        </>
      ) : null}
      {sidebarContributions.map((contribution) => {
        if (contribution.id !== activeSidebarPanel) return null;
        const Panel = contribution.component;
        return (
          <Panel
            activeFile={activeFile}
            editorScrollRef={editorScrollRef}
            key={contribution.id}
            previewRef={previewRef}
            textareaRef={textareaRef}
          />
        );
      })}
      {treeMenu && activeSidebarPanel === 'explorer' ? (
        <TreeContextMenu
          node={treeMenu.node}
          position={treeMenu.position}
          onClose={() => setTreeMenu(null)}
          onCreateFile={() => void createFile(treeMenu.node.path)}
          onCreateFolder={() => void createFolder(treeMenu.node.path)}
          onDuplicate={() => void duplicateFile(treeMenu.node)}
          onRename={() => {
            cancelFileCreation();
            cancelFolderCreation();
            setRenameTarget(treeMenu.node);
          }}
          onTrash={() => void trashEntry(treeMenu.node)}
        />
      ) : null}
      {pendingFolderCreation ? (
        <EntryNameDialog
          confirmLabel={t('sidebar.createAction')}
          initialName={pendingFolderCreation.name}
          inputLabel={t('sidebar.folderNamePrompt')}
          operationId={`create-folder-${pendingFolderCreation.id}`}
          title={t('sidebar.createFolderTitle')}
          onClose={cancelFolderCreation}
          onSubmit={commitFolderCreation}
        />
      ) : null}
      {imagePreview ? (
        <ImagePreviewModal
          canAddToDocument={Boolean(activeFile)}
          image={imagePreview}
          onAddToDocument={() => addImageToDocument(imagePreview)}
          onClose={() => setImagePreview(null)}
        />
      ) : null}
    </aside>
    </>
  );
}

function sidebarFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'),
  ).filter((element) => element.offsetParent !== null);
}

function SidebarPanelTabs({
  activeId,
  contributions,
  onSelect,
}: {
  activeId: string;
  contributions: ReturnType<typeof selectSidebarContributions>;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="sidebar-panel-tabs" role="tablist" aria-label={t('sidebar.panels')}>
      <button aria-selected={activeId === 'explorer'} role="tab" type="button" onClick={() => onSelect('explorer')}>
        {t('sidebar.explorer')}
      </button>
      {contributions.map((contribution) => (
        <button
          aria-selected={activeId === contribution.id}
          key={contribution.id}
          role="tab"
          type="button"
          onClick={() => onSelect(contribution.id)}
        >
          {contribution.id === 'outline.document' ? t('outline.label') : contribution.label}
        </button>
      ))}
    </div>
  );
}

function FolderPath({
  path,
  onOpenFolder,
  onSearch,
}: {
  readonly path: string | null;
  readonly onOpenFolder: (() => void) | null;
  readonly onSearch: () => void;
}) {
  const { t } = useI18n();

  /*
   * With no workspace this used to render "No folder open" inside a bordered
   * box with a magnifier beside it, which reads as a search field you can type
   * into. Now it is plainly a button that opens a folder - or nothing at all
   * on platforms that cannot.
   */
  if (!path) {
    if (!onOpenFolder) return null;
    return (
      <div className="sidebar-folder-path sidebar-folder-path-empty">
        <button className="sidebar-open-folder" type="button" onClick={onOpenFolder}>
          <Icon name="folderOpen" />
          <span>{t('sidebar.openFolderAction')}</span>
        </button>
      </div>
    );
  }

  const label = displayWorkspacePath(path);
  return (
    <div className="sidebar-folder-path" title={label}>
      <span className="sidebar-folder-path-text"><span className="sidebar-folder-path-value">{label}</span></span>
      <div className="sidebar-folder-actions">
        <IconButton label={t('sidebar.searchFiles')} onClick={onSearch}>
          <Icon name="search" />
        </IconButton>
      </div>
    </div>
  );
}

export function PendingFileInput({
  pending,
  onCancel,
  onCommit,
}: {
  pending: PendingFileCreation;
  onCancel: () => void;
  onCommit: (name: string, focusEditor: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submittingRef = useRef(false);
  const [name, setName] = useState(pending.name);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const extensionStart = pending.name.lastIndexOf('.');
    input.setSelectionRange(0, extensionStart > 0 ? extensionStart : pending.name.length);
  }, [pending.id, pending.name]);

  const commit = async (focusEditor: boolean) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    try {
      await onCommit(name, focusEditor);
    } catch (commitError) {
      setError(errorMessage(commitError));
      submittingRef.current = false;
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <div className={`file pending-file ${error ? 'invalid' : ''}`}>
      <Icon name="file" />
      <input
        aria-label={t('sidebar.newFileName')}
        aria-invalid={error ? true : undefined}
        ref={inputRef}
        value={name}
        onBlur={() => void commit(false)}
        onChange={(event) => {
          setName(event.currentTarget.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            void commit(true);
          }
        }}
      />
      {error ? <span className="pending-file-error" role="alert" title={error}>{error}</span> : null}
    </div>
  );
}

export function InlineEntryNameInput({
  initialName,
  label,
  selectBaseName = false,
  onCancel,
  onCommit,
}: {
  initialName: string;
  label: string;
  selectBaseName?: boolean;
  onCancel: () => void;
  onCommit: (name: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelledRef = useRef(false);
  const submittingRef = useRef(false);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const extensionStart = selectBaseName ? initialName.lastIndexOf('.') : -1;
    input.setSelectionRange(0, extensionStart > 0 ? extensionStart : initialName.length);
  }, [initialName, selectBaseName]);

  const commit = async () => {
    if (cancelledRef.current || submittingRef.current) return;
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError(t('sidebar.entryNameRequired'));
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    submittingRef.current = true;
    setError(null);
    try {
      await onCommit(normalizedName);
    } catch (commitError) {
      submittingRef.current = false;
      setError(errorMessage(commitError));
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <>
      <input
        aria-invalid={error ? true : undefined}
        aria-label={label}
        className="inline-entry-name"
        ref={inputRef}
        title={error ?? undefined}
        value={name}
        onBlur={() => void commit()}
        onChange={(event) => {
          setName(event.currentTarget.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            cancelledRef.current = true;
            onCancel();
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            void commit();
          }
        }}
      />
      {error ? <span className="inline-entry-error" role="alert">{error}</span> : null}
    </>
  );
}

function WorkspaceSearchResults({
  activePath,
  error,
  items,
  needsFolder,
  openFiles,
  onOpen,
  onPreviewImage,
}: {
  activePath: string | null;
  error: string | null;
  items: WorkspaceSearchItem[] | null;
  needsFolder: boolean;
  openFiles: OpenFile[];
  onOpen: (path: string) => void;
  onPreviewImage: (item: WorkspaceSearchItem) => void;
}) {
  const { t } = useI18n();
  if (needsFolder) return <div className="workspace-search-message">{t('sidebar.searchNeedsFolder')}</div>;
  if (error) return <div className="workspace-search-message" title={error}>{t('sidebar.searchUnavailable')}</div>;
  if (!items) return <div className="workspace-search-message">{t('sidebar.searching')}</div>;
  if (items.length === 0) return <div className="workspace-search-message">{t('sidebar.noMatches')}</div>;

  return items.map((item) => {
    const imageAsset = isWorkspaceImageAsset(item.path);
    const dirty = isDirty(openFiles.find((file) => file.path === item.path) ?? null);
    return (
      <button
        className={`file workspace-search-result ${item.path === activePath ? 'current' : ''} ${imageAsset ? 'asset-file' : ''}`}
        key={item.path}
        title={item.relativePath}
        type="button"
        onClick={() => (imageAsset ? onPreviewImage(item) : onOpen(item.path))}
      >
        <Icon name={imageAsset ? 'image' : 'file'} />
        <span className="workspace-search-result-text">
          <span className="name">{item.name}</span>
          <span className="workspace-search-result-path">{item.relativePath}</span>
        </span>
        {dirty ? <span className="dirty" title={t('document.unsaved')} /> : null}
      </button>
    );
  });
}

export function FileTreeNodeView({
  node,
  activePath,
  openFiles,
  pendingFileCreation,
  renameTargetPath,
  selectedFolderPath,
  contextTargetPath,
  onCancelFileCreation,
  onCancelRename,
  onCommitFileCreation,
  onCommitRename,
  onToggle,
  onOpen,
  onPreviewImage,
  onContextMenu,
}: {
  node: FileTreeNode;
  activePath: string | null;
  openFiles: OpenFile[];
  pendingFileCreation: PendingFileCreation | null;
  renameTargetPath: string | null;
  selectedFolderPath: string | null;
  contextTargetPath: string | null;
  onCancelFileCreation: () => void;
  onCancelRename: () => void;
  onCommitFileCreation: (name: string, focusEditor: boolean) => Promise<void>;
  onCommitRename: (node: FileTreeNode, name: string) => Promise<void>;
  onToggle: (path: string) => Promise<void>;
  onOpen: (path: string) => void;
  onPreviewImage: (node: FileTreeNode) => void;
  onContextMenu?: (node: FileTreeNode, position: TreeMenuPosition) => void;
}) {
  const { language, t } = useI18n();
  if (node.type === 'folder') {
    const creatingInside = pendingFileCreation?.parentPath === node.path;
    const renaming = renameTargetPath === node.path;
    return (
      <div>
        {renaming ? (
          <div className={`folder renaming ${node.isOpen ? 'open' : ''} ${node.path === selectedFolderPath ? 'selected' : ''}`}>
            <Icon name="chevronRight" className="ic chev" />
            <InlineEntryNameInput
              initialName={node.name}
              label={t('sidebar.renamePrompt')}
              onCancel={onCancelRename}
              onCommit={(name) => onCommitRename(node, name)}
            />
          </div>
        ) : (
          <button
            aria-pressed={node.path === selectedFolderPath}
            className={`folder ${node.isOpen ? 'open' : ''} ${node.path === selectedFolderPath ? 'selected' : ''} ${node.path === contextTargetPath ? 'context-target' : ''}`}
            type="button"
            onPointerDown={preventRightClickSelection}
            onContextMenu={(event) => showTreeContextMenu(event, node, onContextMenu)}
            onKeyDown={(event) => showTreeContextMenuFromKeyboard(event, node, onContextMenu)}
            /* One click selects the folder (the New File target) and opens or
               closes it, so reaching a nested file costs a click per level. */
            onClick={() => void onToggle(node.path)}
          >
            <Icon name="chevronRight" className="ic chev" />
            <span>{node.name}</span>
          </button>
        )}
        {node.isOpen && (node.children || creatingInside) ? (
          <div className="file-list">
            {creatingInside && pendingFileCreation ? (
              <PendingFileInput
                key={pendingFileCreation.id}
                pending={pendingFileCreation}
                onCancel={onCancelFileCreation}
                onCommit={onCommitFileCreation}
              />
            ) : null}
            {(node.children ?? []).map((child) => (
              <FileTreeNodeView
                activePath={activePath}
                key={child.id}
                node={child}
                openFiles={openFiles}
                pendingFileCreation={pendingFileCreation}
                renameTargetPath={renameTargetPath}
                selectedFolderPath={selectedFolderPath}
                contextTargetPath={contextTargetPath}
                onCancelFileCreation={onCancelFileCreation}
                onCancelRename={onCancelRename}
                onCommitFileCreation={onCommitFileCreation}
                onCommitRename={onCommitRename}
                onToggle={onToggle}
                onOpen={onOpen}
                onPreviewImage={onPreviewImage}
                onContextMenu={onContextMenu}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const active = node.path === activePath;
  const openFile = openFiles.find((file) => file.path === node.path);
  const dirty = isDirty(openFile ?? null);
  const imageAsset = isWorkspaceImageAsset(node.path);
  if (renameTargetPath === node.path) {
    return (
      <div className={`file renaming ${active ? 'current' : ''} ${imageAsset ? 'asset-file' : ''}`}>
        <Icon name={imageAsset ? 'image' : 'file'} />
        <InlineEntryNameInput
          initialName={node.name}
          label={t('sidebar.renamePrompt')}
          selectBaseName
          onCancel={onCancelRename}
          onCommit={(name) => onCommitRename(node, name)}
        />
      </div>
    );
  }
  return (
    <button
      className={`file ${active ? 'current' : ''} ${imageAsset ? 'asset-file' : ''} ${node.path === contextTargetPath ? 'context-target' : ''}`}
      title={imageAsset ? node.path : undefined}
      type="button"
      onPointerDown={preventRightClickSelection}
      onContextMenu={(event) => showTreeContextMenu(event, node, onContextMenu)}
      onKeyDown={(event) => showTreeContextMenuFromKeyboard(event, node, onContextMenu)}
      onClick={() => {
        if (imageAsset) {
          onPreviewImage(node);
          return;
        }
        onOpen(node.path);
      }}
    >
      <Icon name={imageAsset ? 'image' : 'file'} />
      <span className="name">{node.name}</span>
      {dirty ? <span className="dirty" title={t('document.unsaved')} /> : <span className="meta">{relativeTime(node.modifiedAt, language)}</span>}
    </button>
  );
}

function showTreeContextMenu(
  event: MouseEvent<HTMLButtonElement>,
  node: FileTreeNode,
  onContextMenu: ((node: FileTreeNode, position: TreeMenuPosition) => void) | undefined,
): void {
  if (!onContextMenu) return;
  event.preventDefault();
  event.stopPropagation();
  window.getSelection()?.removeAllRanges();
  onContextMenu(node, clampTreeMenuPosition(event.clientX, event.clientY));
}

function preventRightClickSelection(event: ReactPointerEvent<HTMLButtonElement>): void {
  if (event.button === 2) window.getSelection()?.removeAllRanges();
}

function showTreeContextMenuFromKeyboard(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  node: FileTreeNode,
  onContextMenu: ((node: FileTreeNode, position: TreeMenuPosition) => void) | undefined,
): void {
  if (!onContextMenu || (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10'))) return;
  event.preventDefault();
  const bounds = event.currentTarget.getBoundingClientRect();
  onContextMenu(node, clampTreeMenuPosition(bounds.left + 20, bounds.bottom));
}

function clampTreeMenuPosition(x: number, y: number): TreeMenuPosition {
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - 196)),
    y: Math.max(8, Math.min(y, window.innerHeight - 190)),
  };
}

export function EntryNameDialog({
  confirmLabel,
  initialName,
  inputLabel,
  operationId,
  selectBaseName = false,
  title,
  onClose,
  onSubmit,
}: {
  confirmLabel: string;
  initialName: string;
  inputLabel: string;
  operationId: string;
  selectBaseName?: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(initialName);
    setError(null);
    setSubmitting(false);
    const frame = window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const extensionStart = selectBaseName ? initialName.lastIndexOf('.') : -1;
      input.setSelectionRange(0, extensionStart > 0 ? extensionStart : initialName.length);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialName, operationId, selectBaseName]);

  const submit = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError(t('sidebar.entryNameRequired'));
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(normalizedName);
    } catch (submitError) {
      setSubmitting(false);
      setError(errorMessage(submitError));
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <Dialog
      closeOnBackdrop={!submitting}
      open
      title={title}
      onClose={() => {
        if (!submitting) onClose();
      }}
    >
      <form
        className="entry-name-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2>{title}</h2>
        <label>
          <span>{inputLabel}</span>
          <input
            aria-invalid={error ? true : undefined}
            disabled={submitting}
            ref={inputRef}
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setError(null);
            }}
          />
        </label>
        {error ? <p className="entry-name-dialog-error" role="alert">{error}</p> : null}
        <DialogActions>
          <Button disabled={submitting} variant="surface" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={submitting} variant="primary" type="submit">{confirmLabel}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function reportFileOperationError(error: unknown, message: string): void {
  notifyError(message, error);
}
