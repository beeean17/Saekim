import { useMemo, useState } from 'react';
import { relativeTime } from '../../lib/format/relativeTime';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { FileTreeNode, OpenFile, RecentFile, SidebarViewMode } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';

export function Sidebar() {
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
  const refresh = useWorkspaceStore((state) => state.refresh);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const sidebarViewMode = useUIStore((state) => state.sidebarViewMode);
  const setSidebarViewMode = useUIStore((state) => state.setSidebarViewMode);
  const [fileSearchOpen, setFileSearchOpen] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const visibleTree = useMemo(() => filterTree(tree, fileSearchQuery), [fileSearchQuery, tree]);
  const visibleRecentFiles = useMemo(() => filterRecentFiles(getRecentEntries(recentFiles, openFiles), fileSearchQuery), [fileSearchQuery, openFiles, recentFiles]);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <button className="brand-mark sidebar-toggle" title="탐색기 접기/펼치기" type="button" onClick={toggleSidebar}>
          <Icon name="sidebar" />
        </button>
        <SidebarActions
          onCreateFile={() => void createFile()}
          onOpenFolder={() => void openFolder()}
          onSearch={() => setFileSearchOpen((open) => !open)}
          onRefresh={() => void refresh()}
        />
        <RailTabs openFiles={openFiles} activeFileId={activeFile?.id ?? null} onClose={closeFile} onSelect={setActiveFile} />
      </div>
      <SidebarViewSwitch mode={sidebarViewMode} onChange={setSidebarViewMode} />
      {sidebarViewMode === 'files' ? <FolderPath path={rootPath} /> : null}
      {fileSearchOpen ? (
        <div className="sidebar-search">
          <Icon name="search" />
          <input
            autoFocus
            value={fileSearchQuery}
            placeholder={sidebarViewMode === 'files' ? '파일 검색' : '최근 파일 검색'}
            onChange={(event) => setFileSearchQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setFileSearchQuery('');
                setFileSearchOpen(false);
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
  onCreateFile,
  onOpenFolder,
  onSearch,
  onRefresh,
}: {
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
}: {
  node: FileTreeNode;
  activePath: string | null;
  openFiles: OpenFile[];
  onToggle: (path: string) => Promise<void>;
  onOpen: (path: string) => void;
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
  return (
    <button className={`file ${active ? 'current' : ''}`} type="button" onClick={() => onOpen(node.path)}>
      <Icon name="file" />
      <span className="name">{node.name}</span>
      {dirty ? <span className="dirty" title="저장 안 됨" /> : <span className="meta">{relativeTime(node.modifiedAt)}</span>}
    </button>
  );
}
