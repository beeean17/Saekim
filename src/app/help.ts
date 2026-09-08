import { Backend } from '../platform/common/backend';

const repositoryUrl = 'https://github.com/beeean17/Saekim';

export function openProjectWebsite(): void {
  void Backend.runtime.openExternalUrl(repositoryUrl);
}

export function showKeyboardShortcuts(): void {
  window.alert([
    'Saekim Keyboard Shortcuts',
    '',
    '⌘N  New File',
    '⌘O  Open File',
    '⌘S  Save',
    '⌘F  Find',
    '⌘H  Replace',
    '⌘K  Command Palette',
    '⌘+ / ⌘− / ⌘0  Zoom',
    '⌘P  Print',
    '⌘⇧E  Export PDF',
  ].join('\n'));
}
