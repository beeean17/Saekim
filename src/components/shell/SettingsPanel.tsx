import { fontSizeOptions, useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import type { ThemeName, ViewMode } from '../../types/workspace';
import { Popover } from '../ui/overlay/Popover';
import { CloseButton } from '../ui/primitives/CloseButton';
import { SegmentedControl } from '../ui/primitives/SegmentedControl';
import { PanelHeader } from '../ui/surface/PanelHeader';

const themes: Array<{ id: ThemeName; label: string }> = [
  { id: 'system', label: '시스템' },
  { id: 'default', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'nord', label: 'Nord' },
];

const viewModes: Array<{ id: ViewMode; label: string }> = [
  { id: 'edit', label: '편집' },
  { id: 'split', label: '분할' },
  { id: 'preview', label: '보기' },
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
  const open = useUIStore((state) => state.settingsOpen);
  const close = useUIStore((state) => state.closeSettings);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);

  const theme = useSettingsStore((state) => state.theme);
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
      ariaLabel="설정"
      ignoreOutsideSelector="[data-settings-trigger='true']"
      onClose={close}
    >
      <PanelHeader
        className="settings-head"
        titleClassName="settings-title"
        descriptionClassName="settings-subtitle"
        title="설정"
        description="편집 환경"
        actions={<CloseButton onClick={close}>닫기</CloseButton>}
      />

      <section className="settings-section">
        <label>테마</label>
        <SegmentedControl
          ariaLabel="테마"
          className="settings-segmented"
          value={theme}
          options={themes.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
          onChange={setTheme}
        />
      </section>

      <section className="settings-section">
        <label>글자 크기</label>
        <SegmentedControl
          ariaLabel="글자 크기"
          className="settings-segmented"
          value={fontSizeId}
          options={fontSizeOptions.map((option) => ({ value: option.id, label: option.label }))}
          onChange={(id) => {
            const option = fontSizeOptions.find((candidate) => candidate.id === id);
            if (option) setFontSize(option.value);
          }}
        />
      </section>

      <section className="settings-section">
        <label htmlFor="editor-font">에디터 폰트</label>
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
        <label>보기 모드</label>
        <SegmentedControl
          ariaLabel="보기 모드"
          className="settings-segmented"
          value={effectiveViewMode}
          options={viewModes
            .filter((mode) => availableViewModes.includes(mode.id))
            .map((mode) => ({ value: mode.id, label: mode.label }))}
          onChange={setViewMode}
        />
      </section>

      <section className="settings-section">
        <label className="settings-check">
          <input checked={syncScroll} type="checkbox" onChange={toggleSyncScroll} />
          스크롤 동기화
        </label>
      </section>

      <section className="settings-section">
        <label className="settings-check">
          <input
            checked={lineNumberPreference ?? !compact}
            type="checkbox"
            onChange={(event) => setShowLineNumbers(event.currentTarget.checked)}
          />
          줄 번호 표시
        </label>
        {lineNumberPreference === null ? (
          <span className="settings-hint">작은 화면에서는 기본으로 숨깁니다.</span>
        ) : null}
      </section>
    </Popover>
  );
}
