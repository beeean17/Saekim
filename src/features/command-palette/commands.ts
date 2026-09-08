import type { CommandContributionFactory } from '../../app/feature';
import { translateCurrent } from '../../i18n/current';

export const commandPaletteCommands: CommandContributionFactory = (ctx) => [
  {
    id: 'commands.openPalette',
    label: translateCurrent('command.palette'),
    defaultShortcut: 'mod+k',
    keywords: ['actions', 'commands'],
    run: ctx.palette.open,
  },
];
