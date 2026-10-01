import type { AppContribution } from '../../app/feature';
import { ConfirmDialog } from './ConfirmDialog';

export const confirmDialogAppContribution: AppContribution = {
  overlays: [{ id: 'confirm-dialog', component: ConfirmDialog }],
};

export { requestChoice, requestConfirmation, type ConfirmChoice, type ConfirmOptions, type ConfirmTone } from './confirm';
