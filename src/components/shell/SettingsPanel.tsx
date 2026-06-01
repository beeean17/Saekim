import { useEffect, useRef } from 'react';
import { fontSizeOptions, useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import type { ThemeName, ViewMode } from '../../types/workspace';

const themes: Array<{ id: ThemeName; label: string }> = [
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

export function SettingsPanel() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const open = useUIStore((state) => state.settingsOpen);
  const close = useUIStore((state) => state.closeSettings);
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
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      close();
    };

    const clickListenerId = window.setTimeout(() => {
      window.addEventListener('click', onClick);
    }, 0);

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(clickListenerId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', onClick);
    };
  }, [close, open]);

  if (!open) return null;

  return (
    <div className="settings-popover" role="dialog" aria-label="설정" ref={panelRef}>
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
        <label>글자 크기</label>
        <div className="settings-segmented" aria-label="글자 크기">
          {fontSizeOptions.map((option) => (
            <button
              className={fontSize === option.value ? 'active' : ''}
              key={option.id}
              type="button"
              onClick={() => setFontSize(option.value)}
            >
              {option.label}
            </button>
          ))}
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
          <input checked={syncScroll} type="checkbox" onChange={toggleSyncScroll} />
          스크롤 동기화
        </label>
      </section>
    </div>
  );
}
