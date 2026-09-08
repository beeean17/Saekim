import { create } from 'zustand';
import type { PreviewInteractionMode } from '../core/preview/surfacePolicy';
import type { UISession } from '../types/session';
import type { SidebarMode, ViewMode } from '../types/workspace';

const DEFAULT_SIDEBAR_WIDTH = 248;
const DEFAULT_EDITOR_WIDTH = 560;
const SPLIT_HANDLE_WIDTH = 12;
const MIN_EDITOR_WIDTH = 240;
const MAX_EDITOR_WIDTH = 1600;
const DEFAULT_PREVIEW_INTERACTION_MODE: PreviewInteractionMode = 'view';

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
  compactSidebarOpen: boolean;
  viewMode: ViewMode;
  sidebarWidth: number;
  splitRatio: number;
  editorWidth: number;
  syncScroll: boolean;
  previewInteractionMode: PreviewInteractionMode;
  settingsOpen: boolean;
  toggleSidebar: () => void;
  toggleCompactSidebar: () => void;
  closeCompactSidebar: () => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  setEditorWidth: (width: number) => void;
  setSyncScroll: (enabled: boolean) => void;
  setPreviewInteractionMode: (mode: PreviewInteractionMode) => void;
  toggleSyncScroll: () => void;
  toggleSettings: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  restoreUI: (ui: UISession) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarMode: 'expanded',
  compactSidebarOpen: false,
  viewMode: 'split',
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  splitRatio: 0.5,
  editorWidth: getInitialEditorWidth(),
  syncScroll: true,
  previewInteractionMode: DEFAULT_PREVIEW_INTERACTION_MODE,
  settingsOpen: false,
  toggleSidebar: () =>
    set((state) => ({
      sidebarMode: state.sidebarMode === 'expanded' ? 'collapsed' : 'expanded',
    })),
  toggleCompactSidebar: () => set((state) => ({ compactSidebarOpen: !state.compactSidebarOpen })),
  closeCompactSidebar: () => set({ compactSidebarOpen: false }),
  setSidebarMode: (mode) => set({ sidebarMode: mode }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarWidth: (width) => set({ sidebarWidth: clamp(width, 180, 420) }),
  setSplitRatio: (ratio) => set({ splitRatio: clamp(ratio, 0.25, 0.75) }),
  setEditorWidth: (width) => set({ editorWidth: clamp(width, MIN_EDITOR_WIDTH, MAX_EDITOR_WIDTH) }),
  setSyncScroll: (enabled) => set({ syncScroll: enabled }),
  setPreviewInteractionMode: (mode) => set({ previewInteractionMode: mode }),
  toggleSyncScroll: () => set((state) => ({ syncScroll: !state.syncScroll })),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  restoreUI: (ui) =>
    set({
      sidebarMode: ui.sidebarMode,
      compactSidebarOpen: false,
      viewMode: ui.viewMode,
      sidebarWidth: ui.sidebarWidth,
      splitRatio: typeof ui.splitRatio === 'number' ? ui.splitRatio : 0.5,
      editorWidth: restoreEditorWidth(ui),
      syncScroll: ui.syncScroll ?? true,
      previewInteractionMode: DEFAULT_PREVIEW_INTERACTION_MODE,
      settingsOpen: false,
    }),
}));
