import { create } from 'zustand';

interface VersionHistoryState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useVersionHistoryStore = create<VersionHistoryState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
