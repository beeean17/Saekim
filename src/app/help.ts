import { Backend } from '../platform/common/backend';
import { openHelpDialog } from '../features/help/store';

const repositoryUrl = 'https://github.com/beeean17/Saekim';

export function openProjectWebsite(): void {
  void Backend.runtime.openExternalUrl(repositoryUrl);
}

/*
 * Shortcuts used to be a hardcoded blocking alert that always drew Cmd glyphs,
 * so it was wrong on Windows and unreadable on every platform. It is a real
 * dialog now, built from the command registry.
 */
export function showKeyboardShortcuts(): void {
  openHelpDialog('shortcuts');
}

export function showAboutDialog(): void {
  openHelpDialog('about');
}
