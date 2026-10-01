import { create } from 'zustand';

export type HelpDialogView = 'shortcuts' | 'about';

interface HelpDialogState {
  view: HelpDialogView | null;
  open(view: HelpDialogView): void;
  close(): void;
}

export const useHelpDialogStore = create<HelpDialogState>()((set) => ({
  view: null,
  open: (view) => set({ view }),
  close: () => set({ view: null }),
}));

export function openHelpDialog(view: HelpDialogView): void {
  useHelpDialogStore.getState().open(view);
}
