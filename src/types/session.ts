import type {
  FileTreeNode,
  OpenFile,
  RecentWorkspace,
  SidebarMode,
  ThemeName,
  ViewMode,
} from './workspace';

export type HtmlPreviewMode = 'browser' | 'safe';

export interface WorkspaceSession {
  rootPath: string | null;
  tree: FileTreeNode[];
  openFiles: OpenFile[];
  activeFileId: string | null;
}

export interface WindowSession {
  id: string;
  label: string;
}

export interface UISession {
  sidebarMode: SidebarMode;
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
  version: 1 | 2;
  savedAt: string;
  window?: WindowSession;
  workspace: WorkspaceSession;
  recentWorkspaces?: RecentWorkspace[];
  ui: UISession;
  settings: SettingsSession;
}
