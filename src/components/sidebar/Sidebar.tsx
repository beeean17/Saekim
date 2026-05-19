import { relativeTime } from '../../lib/format/relativeTime';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { FileTreeNode, OpenFile } from '../../types/workspace';
import { Icon } from '../primitives/Icon';
import { IconButton } from '../primitives/IconButton';

export function Sidebar() {
  const tree = useWorkspaceStore((state) => state.tree);
  const rootPath = useWorkspaceStore((state) => state.rootPath);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const setActiveFile = useWorkspaceStore((state) => state.setActiveFile);
  const refresh = useWorkspaceStore((state) => state.refresh);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-title">탐색기</div>
        <SidebarActions onOpen={() => void openFile()} onRefresh={() => void refresh()} />
        <RailTabs openFiles={openFiles} activeFileId={activeFile?.id ?? null} onSelect={setActiveFile} />
        <button className="rail-more" title="더 보기" type="button">
          +{Math.max(0, openFiles.length - 4)}
        </button>
      </div>
      <PathBar path={rootPath ?? '~/Documents/notes'} />
      <div className="file-tree">
        {tree.map((node) => (
          <FileTreeNodeView activePath={activeFile?.path ?? null} key={node.id} node={node} onOpen={(path) => void openFile(path)} />
        ))}
      </div>
    </aside>
  );
}

function SidebarActions({ onOpen, onRefresh }: { onOpen: () => void; onRefresh: () => void }) {
  return (
    <div className="sidebar-actions">
      <IconButton label="새 파일">
        <Icon name="filePlus" />
      </IconButton>
      <IconButton label="폴더 열기" onClick={onOpen}>
        <Icon name="folder" />
      </IconButton>
      <IconButton label="파일 검색">
        <Icon name="search" />
      </IconButton>
      <IconButton label="새로고침" onClick={onRefresh}>
        <Icon name="refresh" />
      </IconButton>
    </div>
  );
}

function PathBar({ path }: { path: string }) {
  return (
    <div className="sidebar-path">
      <button className="nav-mini" title="뒤로" type="button">
        <Icon name="chevronLeft" />
      </button>
      <button className="nav-mini" title="앞으로" type="button">
        <Icon name="chevronRight" />
      </button>
      <button className="nav-mini" title="상위 폴더" type="button">
        <Icon name="chevronUp" />
      </button>
      <span className="path-text">{path}</span>
    </div>
  );
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
  onOpen,
}: {
  node: FileTreeNode;
  activePath: string | null;
  onOpen: (path: string) => void;
}) {
  if (node.type === 'folder') {
    return (
      <div>
        <div className={`folder ${node.isOpen ? 'open' : ''}`}>
          <Icon name="chevronRight" className="ic chev" />
          <span>{node.name}</span>
        </div>
        {node.isOpen && node.children ? (
          <div className="file-list">
            {node.children.map((child) => (
              <FileTreeNodeView activePath={activePath} key={child.id} node={child} onOpen={onOpen} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const active = node.path === activePath;
  return (
    <button className={`file ${active ? 'current' : ''}`} type="button" onClick={() => onOpen(node.path)}>
      <Icon name="file" />
      <span className="name">{node.name}</span>
      {active ? <span className="dirty" title="저장 안 됨" /> : <span className="meta">{relativeTime(node.modifiedAt)}</span>}
    </button>
  );
}
