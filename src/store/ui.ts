import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UISession } from '../types/session';
import type { SidebarMode, ViewMode } from '../types/workspace';

interface UIState {
  sidebarMode: SidebarMode;
  toolbarExpanded: boolean;
  viewMode: ViewMode;
  splitRatio: number;
  syncScroll: boolean;
  findOpen: boolean;
  settingsOpen: boolean;
  toggleSidebar: () => void;
  toggleToolbarExpanded: () => void;
  setViewMode: (mode: ViewMode) => void;
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
      setSplitRatio: (ratio) => set({ splitRatio: ratio }),
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
        splitRatio: state.splitRatio,
        syncScroll: state.syncScroll,
      }),
    },
  ),
);
