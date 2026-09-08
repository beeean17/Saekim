import type { CommandContributionFactory } from '../../app/feature';

export const searchCommands: CommandContributionFactory = (ctx) => [
  {
    id: 'search.openFind',
    label: 'Find',
    defaultShortcut: 'mod+f',
    menu: { section: 'edit', label: 'Find', group: 'search', order: 10 },
    run: () => ctx.search.openFind(),
  },
  {
    id: 'search.openReplace',
    label: 'Replace',
    defaultShortcut: 'mod+h',
    menu: { section: 'edit', label: 'Replace', group: 'search', order: 20 },
    run: () => ctx.search.openReplace(),
  },
];
