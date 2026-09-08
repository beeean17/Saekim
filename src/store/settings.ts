import { useEffect } from 'react';
import { create } from 'zustand';
import type { HtmlPreviewMode, SettingsSession } from '../types/session';
import type { ResolvedThemeName, ThemeName } from '../types/workspace';

export const fontSizeOptions = [
  { id: 'small', label: '작게', value: 12 },
  { id: 'medium', label: '중간', value: 13.5 },
  { id: 'large', label: '크게', value: 16 },
] as const;

const defaultFontSize = fontSizeOptions[1].value;
const defaultEditorFontFamily = 'Pretendard Variable';

interface SettingsState {
  theme: ThemeName;
  resolvedTheme: ResolvedThemeName;
  fontSize: number;
  editorFontFamily: string;
  htmlPreviewMode: HtmlPreviewMode;
  setTheme: (theme: ThemeName) => void;
  setFontSize: (fontSize: number) => void;
  setEditorFontFamily: (editorFontFamily: string) => void;
  setHtmlPreviewMode: (htmlPreviewMode: HtmlPreviewMode) => void;
  restoreSettings: (settings: SettingsSession) => void;
}

const systemThemeQuery = typeof window === 'undefined' || typeof window.matchMedia !== 'function'
  ? null
  : window.matchMedia('(prefers-color-scheme: dark)');

function resolveTheme(theme: ThemeName): ResolvedThemeName {
  if (theme !== 'system') return theme;
  return systemThemeQuery?.matches ? 'dark' : 'default';
}

function applyTheme(theme: ThemeName): ResolvedThemeName {
  const resolvedTheme = resolveTheme(theme);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }
  return resolvedTheme;
}

function applyEditorSettings(fontSize: number, editorFontFamily: string): void {
  if (typeof document === 'undefined') return;

  const normalizedFontSize = normalizeFontSize(fontSize);
  const fontSizeOption = fontSizeOptions.find((option) => option.value === normalizedFontSize) ?? fontSizeOptions[1];

  document.documentElement.style.setProperty('--editor-font-size', `${normalizedFontSize}px`);
  document.documentElement.style.setProperty('--editor-font-family', editorFontFamily);
  document.documentElement.dataset.editorFontSize = fontSizeOption.id;
}

export function normalizeFontSize(fontSize: number): number {
  return fontSizeOptions.reduce((closest, option) => {
    const currentDistance = Math.abs(option.value - fontSize);
    const closestDistance = Math.abs(closest.value - fontSize);
    return currentDistance < closestDistance ? option : closest;
  }, fontSizeOptions[0]).value;
}

applyEditorSettings(defaultFontSize, defaultEditorFontFamily);
const defaultTheme: ThemeName = 'system';
const defaultResolvedTheme = applyTheme(defaultTheme);

export const useSettingsStore = create<SettingsState>()((set) => ({
  theme: defaultTheme,
  resolvedTheme: defaultResolvedTheme,
  fontSize: defaultFontSize,
  editorFontFamily: defaultEditorFontFamily,
  htmlPreviewMode: 'browser',
  setTheme: (theme) => {
    set({ theme, resolvedTheme: applyTheme(theme) });
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
    const resolvedTheme = applyTheme(settings.theme);
    const fontSize = normalizeFontSize(settings.fontSize);
    applyEditorSettings(fontSize, settings.editorFontFamily);
    set({ ...settings, resolvedTheme, fontSize, htmlPreviewMode: settings.htmlPreviewMode ?? 'browser' });
  },
}));

export function useSystemTheme(): void {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    if (theme !== 'system' || !systemThemeQuery) return;

    const handleChange = () => {
      useSettingsStore.setState({ resolvedTheme: applyTheme('system') });
    };

    handleChange();
    systemThemeQuery.addEventListener('change', handleChange);
    return () => systemThemeQuery.removeEventListener('change', handleChange);
  }, [theme]);
}
