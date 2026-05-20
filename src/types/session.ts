import type { FileTreeNode, OpenFile, RecentFile, SidebarMode, ThemeName, ViewMode } from './workspace';

export interface WorkspaceSession {
  rootPath: string | null;
  tree: FileTreeNode[];
  openFiles: OpenFile[];
  activeFileId: string | null;
  recentFiles?: RecentFile[];
}

export interface UISession {
  sidebarMode: SidebarMode;
  toolbarExpanded: boolean;
  viewMode: ViewMode;
  sidebarWidth: number;
  splitRatio: number;
  editorWidth?: number;
  syncScroll: boolean;
}

export interface SettingsSession {
  theme: ThemeName;
  fontSize: number;
  editorFontFamily: string;
}

export interface AppSession {
  version: 1;
  savedAt: string;
  workspace: WorkspaceSession;
  ui: UISession;
  settings: SettingsSession;
}
