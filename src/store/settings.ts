import { create } from 'zustand';
import type { HtmlPreviewMode, SettingsSession } from '../types/session';
import type { ThemeName } from '../types/workspace';

export const fontSizeOptions = [
  { id: 'small', label: '작게', value: 12 },
  { id: 'medium', label: '중간', value: 13.5 },
  { id: 'large', label: '크게', value: 16 },
] as const;

const defaultFontSize = fontSizeOptions[1].value;
const defaultEditorFontFamily = 'Pretendard Variable';

interface SettingsState {
  theme: ThemeName;
  fontSize: number;
  editorFontFamily: string;
  htmlPreviewMode: HtmlPreviewMode;
  setTheme: (theme: ThemeName) => void;
  setFontSize: (fontSize: number) => void;
  setEditorFontFamily: (editorFontFamily: string) => void;
  setHtmlPreviewMode: (htmlPreviewMode: HtmlPreviewMode) => void;
  restoreSettings: (settings: SettingsSession) => void;
}

function applyEditorSettings(fontSize: number, editorFontFamily: string): void {
  if (typeof document === 'undefined') return;

  document.documentElement.style.setProperty('--editor-font-size', `${normalizeFontSize(fontSize)}px`);
  document.documentElement.style.setProperty('--editor-font-family', editorFontFamily);
}

export function normalizeFontSize(fontSize: number): number {
  return fontSizeOptions.reduce((closest, option) => {
    const currentDistance = Math.abs(option.value - fontSize);
    const closestDistance = Math.abs(closest.value - fontSize);
    return currentDistance < closestDistance ? option : closest;
  }, fontSizeOptions[0]).value;
}

applyEditorSettings(defaultFontSize, defaultEditorFontFamily);

export const useSettingsStore = create<SettingsState>()((set) => ({
  theme: 'default',
  fontSize: defaultFontSize,
  editorFontFamily: defaultEditorFontFamily,
  htmlPreviewMode: 'browser',
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  setFontSize: (fontSize) => {
    const normalizedFontSize = normalizeFontSize(fontSize);
    set((state) => {
      applyEditorSettings(normalizedFontSize, state.editorFontFamily);
      return { fontSize: normalizedFontSize };
    });
  },
  setEditorFontFamily: (editorFontFamily) => {
    set((state) => {
      applyEditorSettings(state.fontSize, editorFontFamily);
      return { editorFontFamily };
    });
  },
  setHtmlPreviewMode: (htmlPreviewMode) => set({ htmlPreviewMode }),
  restoreSettings: (settings) => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    const fontSize = normalizeFontSize(settings.fontSize);
    applyEditorSettings(fontSize, settings.editorFontFamily);
    set({ ...settings, fontSize, htmlPreviewMode: settings.htmlPreviewMode ?? 'browser' });
  },
}));
