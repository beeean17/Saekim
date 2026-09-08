import { fontSizeOptions, useSettingsStore } from '../../store/settings';
import { useI18n } from '../../i18n/useI18n';
import type { AppLanguage } from '../../i18n/messages';
import { useUIStore } from '../../store/ui';
import type { ThemeName, ViewMode } from '../../types/workspace';
import { Popover } from '../ui/overlay/Popover';
import { CloseButton } from '../ui/primitives/CloseButton';
import { SegmentedControl } from '../ui/primitives/SegmentedControl';
import { PanelHeader } from '../ui/surface/PanelHeader';

const themes: Array<{ id: ThemeName; labelKey?: 'settings.theme.system'; label?: string }> = [
  { id: 'system', labelKey: 'settings.theme.system' },
  { id: 'default', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'nord', label: 'Nord' },
];

const viewModes: Array<{ id: ViewMode; labelKey: 'view.edit' | 'view.split' | 'view.preview' }> = [
  { id: 'edit', labelKey: 'view.edit' },
  { id: 'split', labelKey: 'view.split' },
  { id: 'preview', labelKey: 'view.preview' },
];

const fontFamilies = ['Pretendard Variable', 'Pretendard', 'IBM Plex Sans KR', 'JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'ui-monospace'];

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

      <section className="settings-section">
        <label>{t('settings.language')}</label>
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
          options={themes.map((candidate) => ({
            value: candidate.id,
            label: candidate.labelKey ? t(candidate.labelKey) : candidate.label ?? candidate.id,
          }))}
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
          {fontFamilies.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
      </section>

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
            checked={lineNumberPreference ?? !compact}
            type="checkbox"
            onChange={(event) => setShowLineNumbers(event.currentTarget.checked)}
          />
          {t('settings.lineNumbers')}
        </label>
        {lineNumberPreference === null ? (
          <span className="settings-hint">{t('settings.lineNumbers.hint')}</span>
        ) : null}
      </section>
    </Popover>
  );
}
