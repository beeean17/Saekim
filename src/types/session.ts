import type {
  FileTreeNode,
  OpenFile,
  RecentWorkspace,
  SidebarMode,
  ThemeName,
  ViewMode,
} from './workspace';
import type { AppLanguage } from '../i18n/messages';

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
  language?: AppLanguage;
  theme: ThemeName;
  fontSize: number;
  editorFontFamily: string;
  htmlPreviewMode?: HtmlPreviewMode;
  showLineNumbers?: boolean | null;
}

export interface AppSession {
  version: 1 | 2 | 3;
  savedAt: string;
  window?: WindowSession;
  workspace: WorkspaceSession;
  recentWorkspaces?: RecentWorkspace[];
  ui: UISession;
  settings: SettingsSession;
}
