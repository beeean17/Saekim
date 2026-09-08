import type { SidebarContribution } from '../../app/feature';
import { OutlinePanel } from './OutlinePanel';

export const outlineSidebarContribution: SidebarContribution = {
  id: 'outline.document',
  label: '아웃라인',
  component: OutlinePanel,
};
