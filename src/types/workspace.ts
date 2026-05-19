export type ThemeName = 'default' | 'dark' | 'nord';
export type SidebarMode = 'expanded' | 'collapsed';
export type ViewMode = 'edit' | 'split' | 'preview';
export type FileTreeNodeType = 'folder' | 'file';

export interface FileTreeNode {
  id: string;
  name: string;
  type: FileTreeNodeType;
  path: string;
  modifiedAt?: number;
  children?: FileTreeNode[];
  isOpen?: boolean;
}

export interface OpenFile {
  id: string;
  path: string;
  name: string;
  content: string;
  savedContent: string;
  encoding: string;
  eol: 'LF' | 'CRLF';
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
}
