import type { AppContribution } from '../../app/feature';
import { HelpDialog } from './HelpDialog';

export const helpAppContribution: AppContribution = {
  overlays: [{ id: 'help-dialog', component: HelpDialog }],
};

export { openHelpDialog, useHelpDialogStore } from './store';
