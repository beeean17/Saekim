import { useEffect } from 'react';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import type { ThemeName, ViewMode } from '../../types/workspace';

const themes: Array<{ id: ThemeName; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'dark', label: 'Dark' },
  { id: 'nord', label: 'Nord' },
];

const viewModes: Array<{ id: ViewMode; label: string }> = [
  { id: 'edit', label: '편집' },
  { id: 'split', label: '분할' },
  { id: 'preview', label: '보기' },
];

const fontFamilies = ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'ui-monospace'];

export function SettingsPanel() {
  const open = useUIStore((state) => state.settingsOpen);
  const close = useUIStore((state) => state.closeSettings);
  const toolbarExpanded = useUIStore((state) => state.toolbarExpanded);
  const toggleToolbarExpanded = useUIStore((state) => state.toggleToolbarExpanded);
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);

  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const setFontSize = useSettingsStore((state) => state.setFontSize);
  const editorFontFamily = useSettingsStore((state) => state.editorFontFamily);
  const setEditorFontFamily = useSettingsStore((state) => state.setEditorFontFamily);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, open]);

  if (!open) return null;

  return (
    <div className="settings-popover" role="dialog" aria-label="설정">
      <div className="settings-head">
        <div>
          <div className="settings-title">설정</div>
          <div className="settings-subtitle">편집 환경</div>
        </div>
        <button type="button" onClick={close}>
          닫기
        </button>
      </div>

      <section className="settings-section">
        <label>테마</label>
        <div className="settings-segmented">
          {themes.map((candidate) => (
            <button
              className={theme === candidate.id ? 'active' : ''}
              key={candidate.id}
              type="button"
              onClick={() => setTheme(candidate.id)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <label htmlFor="font-size">글자 크기</label>
        <div className="settings-range">
          <input
            id="font-size"
            max={20}
            min={11}
            step={0.5}
            type="range"
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.currentTarget.value))}
          />
          <span>{fontSize}px</span>
        </div>
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
        <div className="settings-segmented">
          {viewModes.map((mode) => (
            <button
              className={viewMode === mode.id ? 'active' : ''}
              key={mode.id}
              type="button"
              onClick={() => setViewMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <label className="settings-check">
          <input checked={toolbarExpanded} type="checkbox" onChange={toggleToolbarExpanded} />
          확장 툴바
        </label>
        <label className="settings-check">
          <input checked={syncScroll} type="checkbox" onChange={toggleSyncScroll} />
          스크롤 동기화
        </label>
      </section>
    </div>
  );
}
