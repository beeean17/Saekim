export type ThemeName = 'system' | 'default' | 'dark' | 'nord';
export type ResolvedThemeName = Exclude<ThemeName, 'system'>;
export type SidebarMode = 'expanded' | 'collapsed';
export type ViewMode = 'edit' | 'split' | 'preview';
export type FileTreeNodeType = 'folder' | 'file';
export type TextEncoding = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be';

export interface FileTreeNode {
  id: string;
  name: string;
  type: FileTreeNodeType;
  path: string;
  modifiedAt?: number;
  children?: FileTreeNode[];
  isOpen?: boolean;
  isLoaded?: boolean;
}

export interface OpenFile {
  id: string;
  path: string;
  displayPath?: string;
  name: string;
  content: string;
  savedContent: string;
  encoding: TextEncoding;
  savedEncoding: TextEncoding;
  eol: 'LF' | 'CRLF';
  hasMixedEol?: boolean;
}

export interface RecentWorkspace {
  id: string;
  path: string;
  name: string;
  openedAt: number;
  windowId?: string;
}

export interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface OpenFilePayload {
  path: string;
  name: string;
  content: string;
  encoding: TextEncoding;
  displayPath?: string | null;
}

export interface FolderPayload {
  rootPath: string;
  tree: FileTreeNode[];
}
