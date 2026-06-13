import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { CommandRegistry } from '../../app/commands';
import { relativeTime } from '../../core/format/relativeTime';
import { Backend } from '../../platform/common/backend';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';
import { isAndroidRuntime } from '../../platform/common/runtime';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { FileTreeNode, OpenFile, ViewMode } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';
import type { AppMenuHandlers } from '../shell/appMenus';
import { Dialog } from '../ui/overlay/Dialog';
import { CloseButton } from '../ui/primitives/CloseButton';
import { SearchField } from '../ui/primitives/SearchField';
import { AndroidSidebarMenu } from './AndroidSidebarMenu';

interface SidebarProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  menuHandlers: AppMenuHandlers;
  commandRegistry: CommandRegistry;
  effectiveViewMode: ViewMode;
  availableViewModes: readonly ViewMode[];
}

export function Sidebar({
  textareaRef,
  menuHandlers,
  commandRegistry,
  effectiveViewMode,
  availableViewModes,
}: SidebarProps) {
  const rootPath = useWorkspaceStore((state) => state.rootPath);
  const tree = useWorkspaceStore((state) => state.tree);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const openFolder = useWorkspaceStore((state) => state.openFolder);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const createFile = useWorkspaceStore((state) => state.createFile);
  const toggleFolder = useWorkspaceStore((state) => state.toggleFolder);
  const updateContent = useWorkspaceStore((state) => state.updateContent);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const canOpenFolder = currentPlatformCapabilities().has('folder.open');
  const isAndroid = isAndroidRuntime();
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = useState(false);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
  const [imagePreview, setImagePreview] = useState<{ path: string; name: string } | null>(null);
  const closeSearch = () => {
    setWorkspaceSearchQuery('');
    setWorkspaceSearchOpen(false);
  };
  const visibleTree = useMemo(() => filterTree(tree, workspaceSearchQuery), [workspaceSearchQuery, tree]);
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
        <button className="brand-mark sidebar-toggle" title="탐색기 접기/펼치기" type="button" onClick={toggleSidebar}>
          <Icon name="sidebar" />
        </button>
        <SidebarActions
          canOpenFolder={canOpenFolder}
          onCreateFile={() => void createFile()}
          onOpenFolder={() => void openFolder()}
          onSearch={() => setWorkspaceSearchOpen((open) => !open)}
          onRefresh={() => void refresh()}
        />
      </div>
      <FolderPath path={rootPath} />
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
        {visibleTree.map((node) => (
          <FileTreeNodeView
            activePath={activeFile?.path ?? null}
            key={node.id}
            node={node}
            openFiles={openFiles}
            onToggle={toggleFolder}
            onOpen={(path) => void openFile(path)}
            onPreviewImage={(node) => setImagePreview({ path: node.path, name: node.name })}
          />
        ))}
      </div>
      {isAndroid ? (
        <AndroidSidebarMenu
          textareaRef={textareaRef}
          handlers={menuHandlers}
          commandRegistry={commandRegistry}
          effectiveViewMode={effectiveViewMode}
          availableViewModes={availableViewModes}
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

function FolderPath({ path }: { path: string | null }) {
  const label = path ? displayWorkspacePath(path) : '열린 폴더 없음';

  return (
    <div className="sidebar-folder-path" title={label}>
      <span>{label}</span>
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

function SidebarActions({
  canOpenFolder,
  onCreateFile,
  onOpenFolder,
  onSearch,
  onRefresh,
}: {
  canOpenFolder: boolean;
  onCreateFile: () => void;
  onOpenFolder: () => void;
  onSearch: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="sidebar-actions">
      <IconButton label="새 파일" onClick={onCreateFile}>
        <Icon name="filePlus" />
      </IconButton>
      {canOpenFolder ? (
        <IconButton label="폴더 열기" onClick={onOpenFolder}>
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
  );
}

function filterTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;

  return nodes.flatMap((node) => {
    const children = node.children ? filterTree(node.children, needle) : [];
    const matched = node.name.toLowerCase().includes(needle);
    if (!matched && children.length === 0) return [];

    return [
      {
        ...node,
        isOpen: node.type === 'folder' ? true : node.isOpen,
        children,
      },
    ];
  });
}

function FileTreeNodeView({
  node,
  activePath,
  openFiles,
  onToggle,
  onOpen,
  onPreviewImage,
}: {
  node: FileTreeNode;
  activePath: string | null;
  openFiles: OpenFile[];
  onToggle: (path: string) => Promise<void>;
  onOpen: (path: string) => void;
  onPreviewImage: (node: FileTreeNode) => void;
}) {
  if (node.type === 'folder') {
    return (
      <div>
        <button
          className={`folder ${node.isOpen ? 'open' : ''}`}
          type="button"
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
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const active = node.path === activePath;
  const openFile = openFiles.find((file) => file.path === node.path);
  const dirty = Boolean(openFile && openFile.content !== openFile.savedContent);
  const imageAsset = isWorkspaceImageAsset(node.path);
  return (
    <button
      className={`file ${active ? 'current' : ''} ${imageAsset ? 'asset-file' : ''}`}
      title={imageAsset ? node.path : undefined}
      type="button"
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
