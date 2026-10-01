import { editorFontOptions, fontSizeOptions, useSettingsStore } from '../../store/settings';
import { useI18n } from '../../i18n/useI18n';
import type { AppLanguage, TranslationKey } from '../../i18n/messages';
import { useUIStore } from '../../store/ui';
import type { ThemeName, ViewMode } from '../../types/workspace';
import { Popover } from '../ui/overlay/Popover';
import { CloseButton } from '../ui/primitives/CloseButton';
import { SegmentedControl } from '../ui/primitives/SegmentedControl';
import { PanelHeader } from '../ui/surface/PanelHeader';

const themes: Array<{ id: ThemeName; labelKey: TranslationKey }> = [
  { id: 'system', labelKey: 'settings.theme.system' },
  { id: 'default', labelKey: 'settings.theme.light' },
  { id: 'dark', labelKey: 'settings.theme.dark' },
  { id: 'nord', labelKey: 'settings.theme.nord' },
];

const viewModes: Array<{ id: ViewMode; labelKey: 'view.edit' | 'view.split' | 'view.preview' }> = [
  { id: 'edit', labelKey: 'view.edit' },
  { id: 'split', labelKey: 'view.split' },
  { id: 'preview', labelKey: 'view.preview' },
];

type LineNumberChoice = 'auto' | 'on' | 'off';

const lineNumberChoices: Array<{ id: LineNumberChoice; labelKey: TranslationKey }> = [
  { id: 'auto', labelKey: 'settings.lineNumbers.auto' },
  { id: 'on', labelKey: 'settings.lineNumbers.on' },
  { id: 'off', labelKey: 'settings.lineNumbers.off' },
];

export function SettingsPanel({
  compact,
  effectiveViewMode,
  availableViewModes,
}: {
  compact: boolean;
  effectiveViewMode: ViewMode;
  availableViewModes: readonly ViewMode[];
}) {
  const { language, t } = useI18n();
  const open = useUIStore((state) => state.settingsOpen);
  const close = useUIStore((state) => state.closeSettings);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const compactSidebarOpen = useUIStore((state) => state.compactSidebarOpen);
  const setSidebarMode = useUIStore((state) => state.setSidebarMode);
  const toggleCompactSidebar = useUIStore((state) => state.toggleCompactSidebar);

  const theme = useSettingsStore((state) => state.theme);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const setFontSize = useSettingsStore((state) => state.setFontSize);
  const editorFontFamily = useSettingsStore((state) => state.editorFontFamily);
  const setEditorFontFamily = useSettingsStore((state) => state.setEditorFontFamily);
  const lineNumberPreference = useSettingsStore((state) => state.showLineNumbers);
  const setShowLineNumbers = useSettingsStore((state) => state.setShowLineNumbers);
  const fontSizeId = fontSizeOptions.find((option) => option.value === fontSize)?.id ?? fontSizeOptions[1].id;
  const sidebarVisible = compact ? compactSidebarOpen : sidebarMode === 'expanded';
  const lineNumberChoice: LineNumberChoice =
    lineNumberPreference === null ? 'auto' : lineNumberPreference ? 'on' : 'off';

  return (
    <Popover
      open={open}
      className="settings-popover"
      ariaLabel={t('settings.title')}
      ignoreOutsideSelector="[data-settings-trigger='true']"
      onClose={close}
    >
      <PanelHeader
        className="settings-head"
        titleClassName="settings-title"
        descriptionClassName="settings-subtitle"
        title={t('settings.title')}
        description={t('settings.description')}
        actions={<CloseButton label={t('common.close')} onClick={close}>{t('common.close')}</CloseButton>}
      />

      <div className="settings-scroll">
        <section className="settings-section">
          <label id="settings-language-label">{t('settings.language')}</label>
          <SegmentedControl
            ariaLabel={t('settings.language')}
            className="settings-segmented"
            value={language}
            options={([
              { value: 'ko', label: t('language.ko') },
              { value: 'en', label: t('language.en') },
            ] satisfies Array<{ value: AppLanguage; label: string }>)}
            onChange={setLanguage}
          />
        </section>

        <section className="settings-section">
          <label>{t('settings.theme')}</label>
          <SegmentedControl
            ariaLabel={t('settings.theme')}
            className="settings-segmented"
            value={theme}
            options={themes.map((candidate) => ({ value: candidate.id, label: t(candidate.labelKey) }))}
            onChange={setTheme}
          />
        </section>

        <section className="settings-section">
          <label>{t('settings.fontSize')}</label>
          <SegmentedControl
            ariaLabel={t('settings.fontSize')}
            className="settings-segmented"
            value={fontSizeId}
            options={fontSizeOptions.map((option) => ({
              value: option.id,
              label: t(`settings.fontSize.${option.id}`),
            }))}
            onChange={(id) => {
              const option = fontSizeOptions.find((candidate) => candidate.id === id);
              if (option) setFontSize(option.value);
            }}
          />
        </section>

        <section className="settings-section">
          <label htmlFor="editor-font">{t('settings.editorFont')}</label>
          <select
            id="editor-font"
            value={editorFontFamily}
            onChange={(event) => setEditorFontFamily(event.currentTarget.value)}
          >
            {editorFontOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </section>

        <section className="settings-section">
          <label>{t('settings.lineNumbers')}</label>
          <SegmentedControl
            ariaLabel={t('settings.lineNumbers')}
            className="settings-segmented"
            value={lineNumberChoice}
            options={lineNumberChoices.map((choice) => ({ value: choice.id, label: t(choice.labelKey) }))}
            onChange={(choice) => setShowLineNumbers(choice === 'auto' ? null : choice === 'on')}
          />
          {lineNumberChoice === 'auto' ? (
            <span className="settings-hint">{t('settings.lineNumbers.hint')}</span>
          ) : null}
        </section>

        {/*
          Below the rule: controls that change the current window right now
          rather than a stored preference. They are duplicated in the header and
          the View menu on purpose, but keeping them mixed in with preferences
          made the panel read as if view mode were a saved setting.
        */}
        <div className="settings-group-divider" role="presentation" />
        <p className="settings-group-title">{t('settings.currentView')}</p>

        <section className="settings-section">
          <label>{t('settings.viewMode')}</label>
          <SegmentedControl
            ariaLabel={t('settings.viewMode')}
            className="settings-segmented"
            value={effectiveViewMode}
            options={viewModes
              .filter((mode) => availableViewModes.includes(mode.id))
              .map((mode) => ({ value: mode.id, label: t(mode.labelKey) }))}
            onChange={setViewMode}
          />
        </section>

        <section className="settings-section">
          <label className="settings-check">
            <input checked={syncScroll} type="checkbox" onChange={toggleSyncScroll} />
            {t('settings.syncScroll')}
          </label>
        </section>

        <section className="settings-section">
          <label className="settings-check">
            <input
              checked={sidebarVisible}
              type="checkbox"
              onChange={(event) => {
                if (compact) {
                  if (event.currentTarget.checked !== compactSidebarOpen) toggleCompactSidebar();
                  return;
                }
                setSidebarMode(event.currentTarget.checked ? 'expanded' : 'collapsed');
              }}
            />
            {t('settings.sidebar')}
          </label>
        </section>
      </div>
    </Popover>
  );
}
