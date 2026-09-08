import { create } from 'zustand';

interface SearchState {
  findOpen: boolean;
  replaceOpen: boolean;
  openFind: () => void;
  openReplace: () => void;
  closeFind: () => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  findOpen: false,
  replaceOpen: false,
  openFind: () => set({ findOpen: true, replaceOpen: false }),
  openReplace: () => set({ findOpen: true, replaceOpen: true }),
  closeFind: () => set({ findOpen: false, replaceOpen: false }),
}));
