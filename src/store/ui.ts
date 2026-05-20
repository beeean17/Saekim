import { create } from 'zustand';
import type { UISession } from '../types/session';
import type { SidebarMode, ViewMode } from '../types/workspace';

const DEFAULT_SIDEBAR_WIDTH = 248;
const DEFAULT_EDITOR_WIDTH = 560;
const SPLIT_HANDLE_WIDTH = 12;
const MIN_EDITOR_WIDTH = 280;
const MAX_EDITOR_WIDTH = 920;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getInitialEditorWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_EDITOR_WIDTH;
  const availableWidth = window.innerWidth - DEFAULT_SIDEBAR_WIDTH - SPLIT_HANDLE_WIDTH;
  const halfWidth = Math.round(availableWidth / 2);
  return clamp(halfWidth, MIN_EDITOR_WIDTH, MAX_EDITOR_WIDTH);
}

function restoreEditorWidth(ui: UISession): number {
  if (ui.editorWidth === undefined) return getInitialEditorWidth();
  if (ui.editorWidth === DEFAULT_EDITOR_WIDTH && ui.splitRatio === 0.5) return getInitialEditorWidth();
  return ui.editorWidth;
}

interface UIState {
  sidebarMode: SidebarMode;
  toolbarExpanded: boolean;
  viewMode: ViewMode;
  sidebarWidth: number;
  splitRatio: number;
  editorWidth: number;
  syncScroll: boolean;
  pdfExportStatus: 'idle' | 'exporting' | 'done' | 'error';
  findOpen: boolean;
  settingsOpen: boolean;
  toggleSidebar: () => void;
  toggleToolbarExpanded: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  setEditorWidth: (width: number) => void;
  toggleSyncScroll: () => void;
  setPdfExportStatus: (status: UIState['pdfExportStatus']) => void;
  openFind: () => void;
  closeFind: () => void;
  toggleSettings: () => void;
  closeSettings: () => void;
  restoreUI: (ui: UISession) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarMode: 'expanded',
  toolbarExpanded: true,
  viewMode: 'split',
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  splitRatio: 0.5,
  editorWidth: getInitialEditorWidth(),
  syncScroll: true,
  pdfExportStatus: 'idle',
  findOpen: false,
  settingsOpen: false,
  toggleSidebar: () =>
    set((state) => ({
      sidebarMode: state.sidebarMode === 'expanded' ? 'collapsed' : 'expanded',
    })),
  toggleToolbarExpanded: () =>
    set((state) => ({
      toolbarExpanded: !state.toolbarExpanded,
    })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarWidth: (width) => set({ sidebarWidth: clamp(width, 180, 420) }),
  setSplitRatio: (ratio) => set({ splitRatio: clamp(ratio, 0.25, 0.75) }),
  setEditorWidth: (width) => set({ editorWidth: clamp(width, MIN_EDITOR_WIDTH, MAX_EDITOR_WIDTH) }),
  toggleSyncScroll: () => set((state) => ({ syncScroll: !state.syncScroll })),
  setPdfExportStatus: (status) => set({ pdfExportStatus: status }),
  openFind: () => set({ findOpen: true }),
  closeFind: () => set({ findOpen: false }),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  closeSettings: () => set({ settingsOpen: false }),
  restoreUI: (ui) =>
    set({ ...ui, editorWidth: restoreEditorWidth(ui), pdfExportStatus: 'idle', findOpen: false, settingsOpen: false }),
}));
