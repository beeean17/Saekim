import type { CommandContributionFactory } from '../../app/feature';

export const searchCommands: CommandContributionFactory = (ctx) => [
  {
    id: 'search.openFind',
    defaultShortcut: 'mod+f',
    menu: { section: 'edit', label: 'Find' },
    run: () => ctx.search.openFind(),
  },
];
