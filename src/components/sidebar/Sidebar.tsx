import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type RefObject } from 'react';
import type { CommandRegistry } from '../../app/commands';
import { enabledFeatures } from '../../app/featureRegistry';
import { relativeTime } from '../../core/format/relativeTime';
import { selectSidebarContributions } from '../../core/sidebar/registry';
import { Backend } from '../../platform/common/backend';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';
import { isDirty, selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { FileTreeNode, OpenFile, ViewMode, WorkspaceSearchItem } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';
import { Dialog } from '../ui/overlay/Dialog';
import { CloseButton } from '../ui/primitives/CloseButton';
import { SearchField } from '../ui/primitives/SearchField';
import { SidebarMenu } from './SidebarMenu';
import { SidebarToggle } from './SidebarToggle';
import { TreeContextMenu, type TreeMenuPosition } from './TreeContextMenu';

interface SidebarProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  editorScrollRef: RefObject<HTMLDivElement>;
  previewRef: RefObject<HTMLDivElement>;
  commandRegistry: CommandRegistry;
  effectiveViewMode: ViewMode;
}

export function Sidebar({
  textareaRef,
  editorScrollRef,
  previewRef,
  commandRegistry,
  effectiveViewMode,
}: SidebarProps) {
  const rootPath = useWorkspaceStore((state) => state.rootPath);
  const tree = useWorkspaceStore((state) => state.tree);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const toggleFolder = useWorkspaceStore((state) => state.toggleFolder);
  const updateContent = useWorkspaceStore((state) => state.updateContent);
  const saveFile = useWorkspaceStore((state) => state.saveFile);
  const renameWorkspaceEntry = useWorkspaceStore((state) => state.renameWorkspaceEntry);
  const removeWorkspaceEntry = useWorkspaceStore((state) => state.removeWorkspaceEntry);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const fileOperationsAvailable = currentPlatformCapabilities().has('folder.operations');
  const sidebarContributions = useMemo(() => selectSidebarContributions(enabledFeatures), []);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState('explorer');
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = useState(false);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
  const [workspaceSearchResults, setWorkspaceSearchResults] = useState<WorkspaceSearchItem[] | null>(null);
  const [workspaceSearchError, setWorkspaceSearchError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ path: string; name: string } | null>(null);
  const [treeMenu, setTreeMenu] = useState<{ node: FileTreeNode; position: TreeMenuPosition } | null>(null);
  const closeSearch = () => {
    setWorkspaceSearchQuery('');
    setWorkspaceSearchOpen(false);
  };
  const searchNeedle = workspaceSearchQuery.trim();

  const refreshAfterOperation = async () => {
    try {
      await refresh();
    } catch (error) {
      reportFileOperationError(error);
    }
  };
  const renameEntry = async (node: FileTreeNode) => {
    const nextName = window.prompt('새 이름', node.name);
    if (!nextName || nextName === node.name) return;
    try {
      const nextPath = await Backend.folders.renameEntry(node.path, nextName);
      renameWorkspaceEntry(node.path, nextPath);
      await refreshAfterOperation();
    } catch (error) {
      reportFileOperationError(error);
    }
  };
  const createFolder = async (parentPath: string) => {
    const name = window.prompt('새 폴더 이름', '새 폴더');
    if (!name) return;
    try {
      await Backend.folders.createFolder(parentPath, name);
      await refreshAfterOperation();
    } catch (error) {
      reportFileOperationError(error);
    }
  };
  const duplicateFile = async (node: FileTreeNode) => {
    try {
      await Backend.folders.duplicateFile(node.path);
      await refreshAfterOperation();
    } catch (error) {
      reportFileOperationError(error);
    }
  };
  const trashEntry = async (node: FileTreeNode) => {
    if (!window.confirm(`“${node.name}”을(를) 휴지통으로 이동할까요?`)) return;
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
      removeWorkspaceEntry(node.path);
      await refreshAfterOperation();
    } catch (error) {
      reportFileOperationError(error);
    }
  };

  useEffect(() => {
    if (!searchNeedle) {
      setWorkspaceSearchResults(null);
      setWorkspaceSearchError(null);
      return;
    }
    if (!rootPath || rootPath.startsWith('~')) {
      setWorkspaceSearchResults([]);
      setWorkspaceSearchError(null);
      return;
    }

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
      window.alert('이미지를 추가할 문서를 먼저 열어주세요.');
      return;
    }

    const imagePath = markdownImagePathForDocument(image.path, activeFile.path);
    insertImageSnippetIntoDocument(textareaRef.current, activeFile, updateContent, markdownImageSnippet(imagePath, image.name));
    setImagePreview(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <SidebarToggle />
        <SidebarMenu
          className="sidebar-actions"
          textareaRef={textareaRef}
          commandRegistry={commandRegistry}
          effectiveViewMode={effectiveViewMode}
        />
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
            canCreateFolder={fileOperationsAvailable && Boolean(rootPath)}
            path={rootPath}
            onCreateFolder={() => rootPath && void createFolder(rootPath)}
            onSearch={() => setWorkspaceSearchOpen((open) => !open)}
            onRefresh={() => void refresh()}
          />
          {workspaceSearchOpen ? (
            <SearchField
              autoFocus
              className="sidebar-search"
              value={workspaceSearchQuery}
              placeholder="워크스페이스에서 찾기"
              onChange={setWorkspaceSearchQuery}
              onEscape={closeSearch}
            />
          ) : null}
          <div className="file-tree">
            {searchNeedle ? (
              <WorkspaceSearchResults
                activePath={activeFile?.path ?? null}
                error={workspaceSearchError}
                items={workspaceSearchResults}
                openFiles={openFiles}
                onOpen={(path) => void openFile(path)}
                onPreviewImage={(item) => setImagePreview({ path: item.path, name: item.name })}
              />
            ) : (
              tree.map((node) => (
                <FileTreeNodeView
                  activePath={activeFile?.path ?? null}
                  key={node.id}
                  node={node}
                  openFiles={openFiles}
                  onToggle={toggleFolder}
                  onOpen={(path) => void openFile(path)}
                  onPreviewImage={(node) => setImagePreview({ path: node.path, name: node.name })}
                  onContextMenu={fileOperationsAvailable ? (node, position) => setTreeMenu({ node, position }) : undefined}
                />
              ))
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
          onCreateFolder={() => void createFolder(treeMenu.node.path)}
          onDuplicate={() => void duplicateFile(treeMenu.node)}
          onRename={() => void renameEntry(treeMenu.node)}
          onTrash={() => void trashEntry(treeMenu.node)}
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
  );
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
  return (
    <div className="sidebar-panel-tabs" role="tablist" aria-label="사이드바 패널">
      <button aria-selected={activeId === 'explorer'} role="tab" type="button" onClick={() => onSelect('explorer')}>
        탐색기
      </button>
      {contributions.map((contribution) => (
        <button
          aria-selected={activeId === contribution.id}
          key={contribution.id}
          role="tab"
          type="button"
          onClick={() => onSelect(contribution.id)}
        >
          {contribution.label}
        </button>
      ))}
    </div>
  );
}

function FolderPath({
  canCreateFolder,
  path,
  onCreateFolder,
  onSearch,
  onRefresh,
}: {
  readonly canCreateFolder: boolean;
  readonly path: string | null;
  readonly onCreateFolder: () => void;
  readonly onSearch: () => void;
  readonly onRefresh: () => void;
}) {
  const label = path ? displayWorkspacePath(path) : '열린 폴더 없음';

  return (
    <div className="sidebar-folder-path" title={label}>
      <span className="sidebar-folder-path-text"><span className="sidebar-folder-path-value">{label}</span></span>
      <div className="sidebar-folder-actions">
        {canCreateFolder ? (
          <IconButton label="새 폴더" onClick={onCreateFolder}>
            <Icon name="folder" />
          </IconButton>
        ) : null}
        <IconButton label="파일 검색" onClick={onSearch}>
          <Icon name="search" />
        </IconButton>
        <IconButton label="새로고침" onClick={onRefresh}>
          <Icon name="refresh" />
        </IconButton>
      </div>
    </div>
  );
}

function displayWorkspacePath(path: string): string {
  if (path.startsWith('~android/')) return path.slice('~android/'.length);
  if (path.startsWith('content://')) return androidContentWorkspaceDisplayName(path);
  return path;
}

function androidContentWorkspaceDisplayName(path: string): string {
  try {
    const url = new URL(path);
    const treeId = androidTreeDocumentId(url);
    if (treeId) return androidDocumentIdDisplayName(treeId);
    if (url.hostname === 'com.android.providers.downloads.documents') return 'Downloads';
    if (url.hostname === 'com.android.externalstorage.documents') return 'Storage';
    if (url.hostname === 'com.android.providers.media.documents') return 'Media';
    return url.hostname || 'Android document';
  } catch {
    return 'Android document';
  }
}

function androidTreeDocumentId(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  const treeIndex = parts.indexOf('tree');
  if (treeIndex < 0 || treeIndex + 1 >= parts.length) return null;
  return decodeURIComponent(parts[treeIndex + 1]);
}

function androidDocumentIdDisplayName(documentId: string): string {
  const withoutVolume = documentId.startsWith('primary:') ? documentId.slice('primary:'.length) : documentId;
  const normalized = withoutVolume.replace(/^\/+/, '');
  if (normalized === 'Download') return 'Downloads';
  if (normalized.startsWith('Download/')) return normalized.replace('Download', 'Downloads').replace(/\//g, ' / ');
  return normalized.replace(/\//g, ' / ') || 'Android document';
}

function WorkspaceSearchResults({
  activePath,
  error,
  items,
  openFiles,
  onOpen,
  onPreviewImage,
}: {
  activePath: string | null;
  error: string | null;
  items: WorkspaceSearchItem[] | null;
  openFiles: OpenFile[];
  onOpen: (path: string) => void;
  onPreviewImage: (item: WorkspaceSearchItem) => void;
}) {
  if (error) return <div className="workspace-search-message" title={error}>검색할 수 없습니다.</div>;
  if (!items) return <div className="workspace-search-message">검색 중…</div>;
  if (items.length === 0) return <div className="workspace-search-message">일치하는 파일이 없습니다.</div>;

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
        {dirty ? <span className="dirty" title="저장 안 됨" /> : null}
      </button>
    );
  });
}

function FileTreeNodeView({
  node,
  activePath,
  openFiles,
  onToggle,
  onOpen,
  onPreviewImage,
  onContextMenu,
}: {
  node: FileTreeNode;
  activePath: string | null;
  openFiles: OpenFile[];
  onToggle: (path: string) => Promise<void>;
  onOpen: (path: string) => void;
  onPreviewImage: (node: FileTreeNode) => void;
  onContextMenu?: (node: FileTreeNode, position: TreeMenuPosition) => void;
}) {
  if (node.type === 'folder') {
    return (
      <div>
        <button
          className={`folder ${node.isOpen ? 'open' : ''}`}
          type="button"
          onContextMenu={(event) => showTreeContextMenu(event, node, onContextMenu)}
          onKeyDown={(event) => showTreeContextMenuFromKeyboard(event, node, onContextMenu)}
          onClick={() => void onToggle(node.path)}
        >
          <Icon name="chevronRight" className="ic chev" />
          <span>{node.name}</span>
        </button>
        {node.isOpen && node.children ? (
          <div className="file-list">
            {node.children.map((child) => (
              <FileTreeNodeView
                activePath={activePath}
                key={child.id}
                node={child}
                openFiles={openFiles}
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
  return (
    <button
      className={`file ${active ? 'current' : ''} ${imageAsset ? 'asset-file' : ''}`}
      title={imageAsset ? node.path : undefined}
      type="button"
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
      {dirty ? <span className="dirty" title="저장 안 됨" /> : <span className="meta">{relativeTime(node.modifiedAt)}</span>}
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
  onContextMenu(node, clampTreeMenuPosition(event.clientX, event.clientY));
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
    y: Math.max(8, Math.min(y, window.innerHeight - 152)),
  };
}

function ImagePreviewModal({
  canAddToDocument,
  image,
  onAddToDocument,
  onClose,
}: {
  canAddToDocument: boolean;
  image: { path: string; name: string };
  onAddToDocument: () => void;
  onClose: () => void;
}) {
  const [src, setSrc] = useState(() => localImagePreviewSrc(image.path));

  useEffect(() => {
    let cancelled = false;
    setSrc(localImagePreviewSrc(image.path));
    if (isContentUriPath(image.path)) {
      void Backend.images
        .resolveImageSrc(image.path)
        .then((resolved) => {
          if (!cancelled && resolved) setSrc(resolved);
        })
        .catch((error) => console.warn('failed to resolve image preview', error));
    }
    return () => {
      cancelled = true;
    };
  }, [image.path]);

  return (
    <Dialog
      open
      title={`${image.name} 미리보기`}
      className="image-preview-modal"
      backdropClassName="image-preview-backdrop"
      onClose={onClose}
    >
        <div className="image-preview-head">
          <div>
            <strong>{image.name}</strong>
            <span>{image.path}</span>
          </div>
          <div className="image-preview-actions">
            <button
              className="image-preview-add"
              disabled={!canAddToDocument}
              type="button"
              title={canAddToDocument ? '현재 문서에 이미지 추가' : '이미지를 추가할 문서를 먼저 열어주세요'}
              onClick={onAddToDocument}
            >
              문서에 추가
            </button>
            <CloseButton className="image-preview-close" onClick={onClose}>
              x
            </CloseButton>
          </div>
        </div>
        <div className="image-preview-body">
          <img alt={image.name} src={src} />
        </div>
    </Dialog>
  );
}

function isWorkspaceImageAsset(path: string): boolean {
  const contentUri = parseContentTreeDocumentUri(path);
  const normalized = (contentUri?.documentId ?? path).replace(/\\/g, '/').toLowerCase();
  return (
    normalized.includes('/.assets/') &&
    /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(normalized)
  );
}

function localImagePreviewSrc(path: string): string {
  return Backend.runtime.toFileSrc(path);
}

function insertImageSnippetIntoDocument(
  textarea: HTMLTextAreaElement | null,
  activeFile: OpenFile,
  updateContent: (id: string, text: string) => void,
  snippet: string,
): void {
  const value = textarea?.value ?? activeFile.content;
  const start = textarea ? textarea.selectionStart : value.length;
  const end = textarea ? textarea.selectionEnd : value.length;
  const insertion = textarea ? snippet : appendBlockSnippet(value, snippet);
  const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
  const cursor = start + insertion.length;

  updateContent(activeFile.id, next);

  if (!textarea) return;
  window.requestAnimationFrame(() => {
    textarea.focus();
    textarea.selectionStart = cursor;
    textarea.selectionEnd = cursor;
  });
}

function appendBlockSnippet(value: string, snippet: string): string {
  if (!value) return snippet;
  return `${value.endsWith('\n') ? '' : '\n'}${snippet}`;
}

function markdownImageSnippet(path: string, altText: string): string {
  const alt = escapeMarkdownAlt(altText.replace(/\.[^.]+$/, '') || '이미지');
  return `![${alt}](<${escapeMarkdownDestination(path)}>)`;
}

function markdownImagePathForDocument(imagePath: string, documentPath: string): string {
  if (isPlaceholderDocumentPath(documentPath)) return normalizePath(imagePath);
  if (isContentUriPath(documentPath)) return markdownImagePathForContentDocument(imagePath, documentPath);

  const image = normalizePath(imagePath);
  const documentDir = parentFolderFromPath(documentPath);
  if (!documentDir || pathRoot(image) !== pathRoot(documentDir)) return image;

  const relative = relativePath(documentDir, image);
  if (!relative || relative.startsWith('../')) return relative || fileNameFromPath(image);
  return relative.startsWith('./') ? relative : `./${relative}`;
}

function markdownImagePathForContentDocument(imagePath: string, documentPath: string): string {
  if (!isContentUriPath(imagePath)) return normalizePath(imagePath);

  const image = parseContentTreeDocumentUri(imagePath);
  const document = parseContentTreeDocumentUri(documentPath);
  if (!image || !document || image.prefix !== document.prefix || image.treeId !== document.treeId) {
    return normalizePath(imagePath);
  }

  const documentParentId = parentContentDocumentId(document.documentId);
  if (!documentParentId || !image.documentId.startsWith(`${documentParentId}/`)) return normalizePath(imagePath);

  const relative = image.documentId.slice(documentParentId.length + 1);
  return relative.startsWith('.') ? `./${relative}` : relative;
}

function relativePath(fromDirectory: string, toPath: string): string {
  const fromParts = pathParts(fromDirectory);
  const toParts = pathParts(toPath);
  let common = 0;

  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common += 1;
  }

  return [...Array.from({ length: fromParts.length - common }, () => '..'), ...toParts.slice(common)].join('/');
}

function parentFolderFromPath(path: string): string | null {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return null;
  return normalized.slice(0, index);
}

function pathParts(path: string): string[] {
  return normalizePath(path)
    .replace(/^[A-Za-z]:\//, '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean);
}

function pathRoot(path: string): string {
  const normalized = normalizePath(path);
  const windowsDrive = normalized.match(/^[A-Za-z]:\//)?.[0];
  if (windowsDrive) return windowsDrive.toUpperCase();
  return normalized.startsWith('/') ? '/' : '';
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function isPlaceholderDocumentPath(path: string): boolean {
  return path.startsWith('~') || path.startsWith('browser://');
}

function isPathInsideWorkspaceEntry(path: string, entryPath: string): boolean {
  return path === entryPath || path.startsWith(`${entryPath}/`) || path.startsWith(`${entryPath}\\`);
}

function reportFileOperationError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  window.alert(`파일 작업을 완료하지 못했습니다.\n${message}`);
}

function isContentUriPath(path: string): boolean {
  return /^content:\/\//i.test(path);
}

function parseContentTreeDocumentUri(path: string): { prefix: string; treeId: string; documentId: string } | null {
  try {
    const url = new URL(path);
    const parts = url.pathname.split('/').filter(Boolean);
    const treeIndex = parts.indexOf('tree');
    const documentIndex = parts.indexOf('document');
    if (url.protocol !== 'content:' || treeIndex < 0 || documentIndex < 0) return null;
    if (treeIndex + 1 >= parts.length || documentIndex + 1 >= parts.length) return null;
    return {
      prefix: `${url.protocol}//${url.host}`,
      treeId: decodeURIComponent(parts[treeIndex + 1]),
      documentId: decodeURIComponent(parts[documentIndex + 1]),
    };
  } catch {
    return null;
  }
}

function parentContentDocumentId(documentId: string): string | null {
  const index = documentId.lastIndexOf('/');
  if (index <= 0) return null;
  return documentId.slice(0, index);
}

function fileNameFromPath(path: string): string {
  return normalizePath(path).split('/').filter(Boolean).pop() ?? 'image';
}

function escapeMarkdownDestination(path: string): string {
  return normalizePath(path).replace(/>/g, '%3E');
}

function escapeMarkdownAlt(value: string): string {
  return value.replace(/]/g, '\\]');
}
