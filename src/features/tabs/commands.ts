import type { CommandContributionFactory } from '../../app/feature';
import { useWorkspaceStore } from '../../store/workspace';

export const tabCommands: CommandContributionFactory = () => [
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `tabs.activate.${index + 1}`,
    defaultShortcut: `mod+${index + 1}`,
    run: () => {
      const state = useWorkspaceStore.getState();
      const file = state.openFiles[index];
      if (file) state.setActiveFile(file.id);
    },
  })),
  {
    id: 'tabs.reopenClosed',
    defaultShortcut: 'mod+shift+t',
    run: () => useWorkspaceStore.getState().reopenClosedFile(),
  },
];
