import type { AppContribution } from '../../app/feature';
import { VersionHistoryDialog } from './VersionHistoryDialog';

export const versionHistoryAppContribution: AppContribution = {
  overlays: [{ id: 'documents.version-history', component: VersionHistoryDialog }],
};
