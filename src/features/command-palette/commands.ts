import type { CommandContributionFactory } from '../../app/feature';

export const commandPaletteCommands: CommandContributionFactory = (ctx) => [
  {
    id: 'commands.openPalette',
    label: 'Show Command Palette',
    defaultShortcut: 'mod+k',
    keywords: ['actions', 'commands'],
    run: ctx.palette.open,
  },
];
