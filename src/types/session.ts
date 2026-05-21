import type { FileTreeNode, OpenFile, RecentFile, SidebarMode, SidebarViewMode, ThemeName, ViewMode } from './workspace';

export interface WorkspaceSession {
  rootPath: string | null;
  tree: FileTreeNode[];
  openFiles: OpenFile[];
  recentFiles?: RecentFile[];
  activeFileId: string | null;
}

export interface UISession {
  sidebarMode: SidebarMode;
  sidebarViewMode?: SidebarViewMode;
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
