import { create } from 'zustand';

interface SearchState {
  findOpen: boolean;
  openFind: () => void;
  closeFind: () => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  findOpen: false,
  openFind: () => set({ findOpen: true }),
  closeFind: () => set({ findOpen: false }),
}));
