import { useEffect } from 'react';
import { create } from 'zustand';
import type { AppLanguage } from '../i18n/messages';
import type { HtmlPreviewMode, SettingsSession } from '../types/session';
import type { ResolvedThemeName, ThemeName } from '../types/workspace';

export const fontSizeOptions = [
  { id: 'small', value: 12 },
  { id: 'medium', value: 13.5 },
  { id: 'large', value: 16 },
] as const;

export const defaultEditorFontSize = fontSizeOptions[1].value;
const defaultEditorFontFamily = 'Pretendard Variable';

interface SettingsState {
  language: AppLanguage;
  theme: ThemeName;
  resolvedTheme: ResolvedThemeName;
  fontSize: number;
  editorFontFamily: string;
  htmlPreviewMode: HtmlPreviewMode;
  showLineNumbers: boolean | null;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: ThemeName) => void;
  setFontSize: (fontSize: number) => void;
  setEditorFontFamily: (editorFontFamily: string) => void;
  setHtmlPreviewMode: (htmlPreviewMode: HtmlPreviewMode) => void;
  setShowLineNumbers: (showLineNumbers: boolean) => void;
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

function applyLanguage(language: AppLanguage): void {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
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

export function stepFontSize(fontSize: number, direction: -1 | 1): number {
  const normalized = normalizeFontSize(fontSize);
  const index = fontSizeOptions.findIndex((option) => option.value === normalized);
  const nextIndex = Math.min(fontSizeOptions.length - 1, Math.max(0, index + direction));
  return fontSizeOptions[nextIndex].value;
}

applyEditorSettings(defaultEditorFontSize, defaultEditorFontFamily);
const defaultTheme: ThemeName = 'system';
const defaultResolvedTheme = applyTheme(defaultTheme);
const defaultLanguage: AppLanguage = 'ko';
applyLanguage(defaultLanguage);

export const useSettingsStore = create<SettingsState>()((set) => ({
  language: defaultLanguage,
  theme: defaultTheme,
  resolvedTheme: defaultResolvedTheme,
  fontSize: defaultEditorFontSize,
  editorFontFamily: defaultEditorFontFamily,
  htmlPreviewMode: 'browser',
  showLineNumbers: null,
  setLanguage: (language) => {
    applyLanguage(language);
    set({ language });
  },
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
  setShowLineNumbers: (showLineNumbers) => set({ showLineNumbers }),
  restoreSettings: (settings) => {
    const language: AppLanguage = settings.language === 'en' ? 'en' : defaultLanguage;
    const resolvedTheme = applyTheme(settings.theme);
    const fontSize = normalizeFontSize(settings.fontSize);
    applyEditorSettings(fontSize, settings.editorFontFamily);
    applyLanguage(language);
    set({
      ...settings,
      language,
      resolvedTheme,
      fontSize,
      htmlPreviewMode: settings.htmlPreviewMode ?? 'browser',
      showLineNumbers: settings.showLineNumbers ?? null,
    });
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
