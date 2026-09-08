import type { CommandContributionFactory } from '../../app/feature';
import { useWorkspaceStore } from '../../store/workspace';
import { translateCurrent } from '../../i18n/current';

export const tabCommands: CommandContributionFactory = () => [
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `tabs.activate.${index + 1}`,
    label: translateCurrent('command.switchTab', { number: index + 1 }),
    defaultShortcut: `mod+${index + 1}`,
    isEnabled: () => useWorkspaceStore.getState().openFiles.length > index,
    run: () => {
      const state = useWorkspaceStore.getState();
      const file = state.openFiles[index];
      if (file) state.setActiveFile(file.id);
    },
  })),
  {
    id: 'tabs.reopenClosed',
    label: translateCurrent('command.reopenTab'),
    defaultShortcut: 'mod+shift+t',
    isEnabled: () => useWorkspaceStore.getState().closedFiles.length > 0,
    run: () => useWorkspaceStore.getState().reopenClosedFile(),
  },
];
