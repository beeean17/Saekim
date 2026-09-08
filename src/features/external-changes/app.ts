import type { AppContribution } from '../../app/feature';
import { ExternalChangeDialog } from './ExternalChangeDialog';

export const externalChangesAppContribution: AppContribution = {
  overlays: [{ id: 'files.external-change-dialog', component: ExternalChangeDialog }],
};
