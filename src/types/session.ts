import type { FileTreeNode, OpenFile, RecentFile, SidebarMode, SidebarViewMode, ThemeName, ViewMode } from './workspace';

export type HtmlPreviewMode = 'browser' | 'safe';

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
  htmlPreviewMode?: HtmlPreviewMode;
}

export interface AppSession {
  version: 1;
  savedAt: string;
  workspace: WorkspaceSession;
  ui: UISession;
  settings: SettingsSession;
}
