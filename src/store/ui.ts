import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UISession } from '../types/session';
import type { SidebarMode, ViewMode } from '../types/workspace';

interface UIState {
  sidebarMode: SidebarMode;
  toolbarExpanded: boolean;
  viewMode: ViewMode;
  sidebarWidth: number;
  splitRatio: number;
  syncScroll: boolean;
  findOpen: boolean;
  settingsOpen: boolean;
  toggleSidebar: () => void;
  toggleToolbarExpanded: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  toggleSyncScroll: () => void;
  openFind: () => void;
  closeFind: () => void;
  toggleSettings: () => void;
  closeSettings: () => void;
  restoreUI: (ui: UISession) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarMode: 'expanded',
      toolbarExpanded: true,
      viewMode: 'split',
      sidebarWidth: 248,
      splitRatio: 0.5,
      syncScroll: true,
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
      setSidebarWidth: (width) => set({ sidebarWidth: Math.min(420, Math.max(180, width)) }),
      setSplitRatio: (ratio) => set({ splitRatio: Math.min(0.75, Math.max(0.25, ratio)) }),
      toggleSyncScroll: () => set((state) => ({ syncScroll: !state.syncScroll })),
      openFind: () => set({ findOpen: true }),
      closeFind: () => set({ findOpen: false }),
      toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
      closeSettings: () => set({ settingsOpen: false }),
      restoreUI: (ui) => set({ ...ui, findOpen: false, settingsOpen: false }),
    }),
    {
      name: 'saekim-ui',
      partialize: (state) => ({
        sidebarMode: state.sidebarMode,
        toolbarExpanded: state.toolbarExpanded,
        viewMode: state.viewMode,
        sidebarWidth: state.sidebarWidth,
        splitRatio: state.splitRatio,
        syncScroll: state.syncScroll,
      }),
    },
  ),
);
