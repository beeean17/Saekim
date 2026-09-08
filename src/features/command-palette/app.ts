import type { AppContribution } from '../../app/feature';
import { CommandPalette } from './CommandPalette';

export const commandPaletteAppContribution: AppContribution = {
  overlays: [{ id: 'commands.palette', component: CommandPalette }],
};
