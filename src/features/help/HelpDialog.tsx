import { useMemo } from 'react';
import './help.css';
import { formatShortcut } from '../../app/commands';
import type { AppOverlayProps, CommandContribution } from '../../app/feature';
import { Dialog } from '../../components/ui/overlay/Dialog';
import { CloseButton } from '../../components/ui/primitives/CloseButton';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/messages';
import { openProjectWebsite } from '../../app/help';
import { useHelpDialogStore } from './store';

const sectionOrder: Array<{ section: string; labelKey: TranslationKey }> = [
  { section: 'file', labelKey: 'menu.file' },
  { section: 'edit', labelKey: 'menu.edit' },
  { section: 'view', labelKey: 'menu.view' },
  { section: 'window', labelKey: 'menu.window' },
];

export function HelpDialog({ commandRegistry }: AppOverlayProps) {
  const { t } = useI18n();
  const view = useHelpDialogStore((state) => state.view);
  const close = useHelpDialogStore((state) => state.close);

  /*
   * The shortcut list is derived from the command registry rather than written
   * out by hand, so it can never drift from the keys that actually work - and
   * formatShortcut renders them for the platform the user is on.
   */
  const groups = useMemo(() => {
    const withShortcuts = Array.from(commandRegistry.values()).filter(
      (command): command is CommandContribution & { defaultShortcut: string } => Boolean(command.defaultShortcut),
    );
    const known = sectionOrder.map(({ section, labelKey }) => ({
      labelKey,
      commands: withShortcuts
        .filter((command) => command.menu?.section === section)
        .sort((left, right) => (left.menu?.order ?? 0) - (right.menu?.order ?? 0)),
    }));
    const other = withShortcuts.filter(
      (command) => !sectionOrder.some(({ section }) => command.menu?.section === section),
    );
    return [...known, { labelKey: 'shortcuts.other' as TranslationKey, commands: other }].filter(
      (group) => group.commands.length > 0,
    );
  }, [commandRegistry]);

  return (
    <Dialog
      className="help-dialog"
      open={view !== null}
      title={view === 'about' ? t('menu.about') : t('shortcuts.title')}
      onClose={close}
    >
      <header className="help-dialog-head">
        <h2>{view === 'about' ? t('menu.about') : t('shortcuts.title')}</h2>
        <CloseButton label={t('common.close')} onClick={close} />
      </header>

      {view === 'about' ? (
        <div className="help-about">
          <p className="help-about-name">Saekim</p>
          <p className="help-about-version">{t('about.version', { version: __APP_VERSION__ })}</p>
          <button className="help-about-link" type="button" onClick={openProjectWebsite}>
            {t('menu.github')}
          </button>
        </div>
      ) : (
        <div className="help-shortcuts">
          {groups.map((group) => (
            <section key={group.labelKey}>
              <h3>{t(group.labelKey)}</h3>
              <dl>
                {group.commands.map((command) => (
                  <div className="help-shortcut-row" key={command.id}>
                    <dt>{command.menu?.label ?? command.label}</dt>
                    <dd>
                      <kbd>{formatShortcut(command.defaultShortcut)}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </Dialog>
  );
}
