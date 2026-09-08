import type { CommandContributionFactory } from '../../app/feature';
import { translateCurrent } from '../../i18n/current';

export const versionHistoryCommands: CommandContributionFactory = (ctx) => [
  {
    id: 'documents.openVersionHistory',
    label: translateCurrent('command.versionHistory'),
    defaultShortcut: 'mod+shift+h',
    keywords: ['history', 'snapshot', 'restore', 'autosave'],
    menu: { section: 'file', group: 'history', order: 80 },
    isEnabled: ctx.history.hasDocument,
    run: ctx.history.open,
  },
];
