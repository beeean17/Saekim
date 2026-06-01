import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { relativeTime } from '../../lib/format/relativeTime';
import { isTauriRuntime } from '../../lib/tauri/invoke';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { FileTreeNode, OpenFile, RecentFile, SidebarViewMode } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';

export function Sidebar({ textareaRef }: { textareaRef: RefObject<HTMLTextAreaElement> }) {
  const rootPath = useWorkspaceStore((state) => state.rootPath);
  const tree = useWorkspaceStore((state) => state.tree);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const recentFiles = useWorkspaceStore((state) => state.recentFiles);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const openFolder = useWorkspaceStore((state) => state.openFolder);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const createFile = useWorkspaceStore((state) => state.createFile);
  const toggleFolder = useWorkspaceStore((state) => state.toggleFolder);
  const setActiveFile = useWorkspaceStore((state) => state.setActiveFile);
  const closeFile = useWorkspaceStore((state) => state.closeFile);
  const updateContent = useWorkspaceStore((state) => state.updateContent);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const sidebarViewMode = useUIStore((state) => state.sidebarViewMode);
  const setSidebarViewMode = useUIStore((state) => state.setSidebarViewMode);
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = useState(false);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
  const [recentSearchOpen, setRecentSearchOpen] = useState(false);
  const [recentSearchQuery, setRecentSearchQuery] = useState('');
  const [imagePreview, setImagePreview] = useState<{ path: string; name: string } | null>(null);
  const searchOpen = sidebarViewMode === 'files' ? workspaceSearchOpen : recentSearchOpen;
  const searchQuery = sidebarViewMode === 'files' ? workspaceSearchQuery : recentSearchQuery;
  const setSearchQuery = sidebarViewMode === 'files' ? setWorkspaceSearchQuery : setRecentSearchQuery;
  const closeSearch =
    sidebarViewMode === 'files'
      ? () => {
          setWorkspaceSearchQuery('');
          setWorkspaceSearchOpen(false);
        }
      : () => {
          setRecentSearchQuery('');
          setRecentSearchOpen(false);
        };
  const visibleTree = useMemo(() => filterTree(tree, workspaceSearchQuery), [workspaceSearchQuery, tree]);
  const visibleRecentFiles = useMemo(
    () => filterRecentFiles(getRecentEntries(recentFiles, openFiles), recentSearchQuery),
    [recentSearchQuery, openFiles, recentFiles],
  );
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
          mode={sidebarViewMode}
          onCreateFile={() => void createFile()}
          onOpenFolder={() => void openFolder()}
          onSearch={() => {
            if (sidebarViewMode === 'files') {
              setWorkspaceSearchOpen((open) => !open);
              return;
            }
            setRecentSearchOpen((open) => !open);
          }}
          onRefresh={() => void refresh()}
        />
        <RailTabs openFiles={openFiles} activeFileId={activeFile?.id ?? null} onClose={closeFile} onSelect={setActiveFile} />
      </div>
      <SidebarViewSwitch mode={sidebarViewMode} onChange={setSidebarViewMode} />
      {sidebarViewMode === 'files' ? <FolderPath path={rootPath} /> : null}
      {searchOpen ? (
        <div className="sidebar-search">
          <Icon name="search" />
          <input
            autoFocus
            value={searchQuery}
            placeholder={sidebarViewMode === 'files' ? '워크스페이스에서 찾기' : '최근 파일에서 찾기'}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                closeSearch();
              }
            }}
          />
        </div>
      ) : null}
      {sidebarViewMode === 'files' ? (
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
      ) : (
        <RecentFilesView
          activePath={activeFile?.path ?? null}
          files={visibleRecentFiles}
          openFiles={openFiles}
          onOpen={(path) => void openFile(path)}
        />
      )}
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

function SidebarViewSwitch({ mode, onChange }: { mode: SidebarViewMode; onChange: (mode: SidebarViewMode) => void }) {
  return (
    <div className="sidebar-view-switch" role="tablist" aria-label="사이드바 보기">
      <button className={mode === 'files' ? 'active' : ''} type="button" role="tab" aria-selected={mode === 'files'} onClick={() => onChange('files')}>
        워크스페이스
      </button>
      <button className={mode === 'recent' ? 'active' : ''} type="button" role="tab" aria-selected={mode === 'recent'} onClick={() => onChange('recent')}>
        최근
      </button>
    </div>
  );
}

function FolderPath({ path }: { path: string | null }) {
  const label = path || '열린 폴더 없음';

  return (
    <div className="sidebar-folder-path" title={label}>
      <span>{label}</span>
    </div>
  );
}

function SidebarActions({
  mode,
  onCreateFile,
  onOpenFolder,
  onSearch,
  onRefresh,
}: {
  mode: SidebarViewMode;
  onCreateFile: () => void;
  onOpenFolder: () => void;
  onSearch: () => void;
  onRefresh: () => void;
}) {
  if (mode === 'recent') {
    return (
      <div className="sidebar-actions">
        <IconButton label="최근 파일 검색" onClick={onSearch}>
          <Icon name="search" />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="sidebar-actions">
      <IconButton label="새 파일" onClick={onCreateFile}>
        <Icon name="filePlus" />
      </IconButton>
      <IconButton label="폴더 열기" onClick={onOpenFolder}>
        <Icon name="folder" />
      </IconButton>
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

function getRecentEntries(recentFiles: RecentFile[], openFiles: OpenFile[]): RecentFile[] {
  const entries = [...recentFiles];
  const knownPaths = new Set(entries.map((file) => file.path));

  for (const file of openFiles) {
    if (!knownPaths.has(file.path)) {
      entries.unshift({ path: file.path, name: file.name, openedAt: Date.now() });
    }
  }

  return entries;
}

function filterRecentFiles(files: RecentFile[], query: string): RecentFile[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return files;

  return files.filter((file) => `${file.name} ${file.path}`.toLowerCase().includes(needle));
}

function RecentFilesView({
  files,
  openFiles,
  activePath,
  onOpen,
}: {
  files: RecentFile[];
  openFiles: OpenFile[];
  activePath: string | null;
  onOpen: (path: string) => void;
}) {
  return (
    <div className="recent-file-list">
      {files.length === 0 ? (
        <p className="sidebar-empty">최근 파일 없음</p>
      ) : (
        files.map((file) => {
          const openFile = openFiles.find((candidate) => candidate.path === file.path);
          const dirty = Boolean(openFile && openFile.content !== openFile.savedContent);
          const active = file.path === activePath;

          return (
            <button className={`recent-file ${active ? 'current' : ''}`} key={file.path} type="button" title={file.path} onClick={() => onOpen(file.path)}>
              <Icon name="file" />
              <span className="recent-file-text">
                <span className="name">{file.name}</span>
                <span className="path">{parentPath(file.path)}</span>
              </span>
              {dirty ? <span className="dirty" title="저장 안 됨" /> : <span className="meta">{relativeTime(file.openedAt)}</span>}
            </button>
          );
        })
      )}
    </div>
  );
}

function parentPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : normalized;
}

function RailTabs({
  openFiles,
  activeFileId,
  onClose,
  onSelect,
}: {
  openFiles: OpenFile[];
  activeFileId: string | null;
  onClose: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const [tooltip, setTooltip] = useState<{ name: string; top: number } | null>(null);

  return (
    <div className="rail-tabs-wrap">
      <div className="rail-tabs">
        {openFiles.map((file) => {
          const dirty = file.content !== file.savedContent;
          const close = () => {
            if (dirty && !window.confirm(`${file.name} 파일의 저장되지 않은 변경사항을 버리고 닫을까요?`)) return;
            onClose(file.id);
          };
          return (
            <div
              className="rail-tab-wrap"
              key={file.id}
              onBlur={() => setTooltip(null)}
              onFocus={(event) => {
                const scroller = event.currentTarget.parentElement;
                setTooltip({ name: file.name, top: event.currentTarget.offsetTop - (scroller?.scrollTop ?? 0) + 18 });
              }}
              onMouseEnter={(event) => {
                const scroller = event.currentTarget.parentElement;
                setTooltip({ name: file.name, top: event.currentTarget.offsetTop - (scroller?.scrollTop ?? 0) + 18 });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <button
                aria-label={`${file.name}${dirty ? ', 수정 중' : ''}`}
                className={`rail-tab ${file.id === activeFileId ? 'active' : ''}`}
                title={`${file.name}${dirty ? '  ●  수정 중' : ''}`}
                type="button"
                onClick={() => onSelect(file.id)}
              >
                <Icon name="file" />
                {dirty ? <span className="dirty-dot" /> : null}
              </button>
              <button className="rail-tab-close" title={`${file.name} 닫기`} type="button" onClick={close}>
                x
              </button>
            </div>
          );
        })}
      </div>
      {tooltip ? (
        <span className="rail-tab-label" role="tooltip" style={{ top: tooltip.top }}>
          {tooltip.name}
        </span>
      ) : null}
    </div>
  );
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
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="image-preview-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="image-preview-modal" role="dialog" aria-modal="true" aria-label={`${image.name} 미리보기`} onMouseDown={(event) => event.stopPropagation()}>
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
            <button className="image-preview-close" type="button" title="닫기" onClick={onClose}>
              x
            </button>
          </div>
        </div>
        <div className="image-preview-body">
          <img alt={image.name} src={localImagePreviewSrc(image.path)} />
        </div>
      </div>
    </div>
  );
}

function isWorkspaceImageAsset(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').toLowerCase();
  return (
    normalized.includes('/.assets/') &&
    /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(normalized)
  );
}

function localImagePreviewSrc(path: string): string {
  if (isTauriRuntime()) return convertFileSrc(path);
  const normalized = path.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${encodeURI(normalized)}` : encodeURI(normalized);
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

  const image = normalizePath(imagePath);
  const documentDir = parentFolderFromPath(documentPath);
  if (!documentDir || pathRoot(image) !== pathRoot(documentDir)) return image;

  const relative = relativePath(documentDir, image);
  if (!relative || relative.startsWith('../')) return relative || fileNameFromPath(image);
  return relative.startsWith('./') ? relative : `./${relative}`;
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

function fileNameFromPath(path: string): string {
  return normalizePath(path).split('/').filter(Boolean).pop() ?? 'image';
}

function escapeMarkdownDestination(path: string): string {
  return normalizePath(path).replace(/>/g, '%3E');
}

function escapeMarkdownAlt(value: string): string {
  return value.replace(/]/g, '\\]');
}
