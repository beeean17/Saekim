import type { MetadataContribution } from '../../app/feature';
import { canUseBlockLayouts, readBlockLayouts, writeBlockLayouts } from './preview';

export const blockLayoutMetadataContribution: MetadataContribution = {
  readLayout: (file) => (canUseBlockLayouts(file.path, true) ? readBlockLayouts(file.path) : Promise.resolve([])),
  writeLayout: (layout) => writeBlockLayouts([layout]),
};
