import type { CommandContributionFactory } from '../../app/feature';
import { translateCurrent } from '../../i18n/current';

export const searchCommands: CommandContributionFactory = (ctx) => [
  {
    id: 'search.openFind',
    label: translateCurrent('command.find'),
    defaultShortcut: 'mod+f',
    menu: { section: 'edit', label: translateCurrent('command.find'), group: 'search', order: 10 },
    run: () => ctx.search.openFind(),
  },
  {
    id: 'search.openReplace',
    label: translateCurrent('command.replace'),
    defaultShortcut: 'mod+h',
    menu: { section: 'edit', label: translateCurrent('command.replace'), group: 'search', order: 20 },
    run: () => ctx.search.openReplace(),
  },
];
