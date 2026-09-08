import { Backend } from '../platform/common/backend';
import { translateCurrent } from '../i18n/current';

const repositoryUrl = 'https://github.com/beeean17/Saekim';

export function openProjectWebsite(): void {
  void Backend.runtime.openExternalUrl(repositoryUrl);
}

export function showKeyboardShortcuts(): void {
  window.alert([
    translateCurrent('shortcuts.title'),
    '',
    `⌘N  ${translateCurrent('command.newFile')}`,
    `⌘O  ${translateCurrent('command.openFile').replace(/…$/, '')}`,
    `⌘S  ${translateCurrent('command.save')}`,
    `⌘F  ${translateCurrent('command.find')}`,
    `⌘H  ${translateCurrent('command.replace')}`,
    `⌘K  ${translateCurrent('command.palette')}`,
    `⌘+ / ⌘− / ⌘0  ${translateCurrent('shortcuts.zoom')}`,
    `⌘P  ${translateCurrent('command.print').replace(/…$/, '')}`,
    `⌘⇧E  ${translateCurrent('command.exportPdf')}`,
  ].join('\n'));
}
