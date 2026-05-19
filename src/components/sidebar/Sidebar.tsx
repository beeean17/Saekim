import { useMemo, useState } from 'react';
import { relativeTime } from '../../lib/format/relativeTime';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { FileTreeNode, OpenFile } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';

export function Sidebar() {
  const tree = useWorkspaceStore((state) => state.tree);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const openFolder = useWorkspaceStore((state) => state.openFolder);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const createFile = useWorkspaceStore((state) => state.createFile);
  const toggleFolder = useWorkspaceStore((state) => state.toggleFolder);
  const setActiveFile = useWorkspaceStore((state) => state.setActiveFile);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const [fileSearchOpen, setFileSearchOpen] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const visibleTree = useMemo(() => filterTree(tree, fileSearchQuery), [fileSearchQuery, tree]);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-title">탐색기</div>
        <SidebarActions
          onCreateFile={() => void createFile()}
          onOpenFolder={() => void openFolder()}
          onSearch={() => setFileSearchOpen((open) => !open)}
          onRefresh={() => void refresh()}
        />
        <RailTabs openFiles={openFiles} activeFileId={activeFile?.id ?? null} onSelect={setActiveFile} />
        <button className="rail-more" title="더 보기" type="button">
          +{Math.max(0, openFiles.length - 4)}
        </button>
      </div>
      {fileSearchOpen ? (
        <div className="sidebar-search">
          <Icon name="search" />
          <input
            autoFocus
            value={fileSearchQuery}
            placeholder="파일 검색"
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
    </aside>
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

function RailTabs({
  openFiles,
  activeFileId,
  onSelect,
}: {
  openFiles: OpenFile[];
  activeFileId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rail-tabs-wrap">
      <div className="rail-tabs">
        {openFiles.map((file) => {
          const dirty = file.content !== file.savedContent;
          return (
            <button
              className={`rail-tab ${file.id === activeFileId ? 'active' : ''}`}
              key={file.id}
              title={`${file.name}${dirty ? '  ●  수정 중' : ''}`}
              type="button"
              onClick={() => onSelect(file.id)}
            >
              <Icon name="file" />
              {dirty ? <span className="dirty-dot" /> : null}
            </button>
          );
        })}
      </div>
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
