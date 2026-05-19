import type { OpenFile, SidebarMode, ThemeName, ViewMode } from './workspace';

export interface WorkspaceSession {
  rootPath: string | null;
  openFiles: OpenFile[];
  activeFileId: string | null;
}

export interface UISession {
  sidebarMode: SidebarMode;
  toolbarExpanded: boolean;
  viewMode: ViewMode;
  splitRatio: number;
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
