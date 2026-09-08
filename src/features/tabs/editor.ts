import type { EditorContribution } from '../../app/feature';
import { TabStrip } from './TabStrip';

export const tabsEditorContribution: EditorContribution = {
  topBars: [{ id: 'tabs.document-strip', component: TabStrip }],
};
