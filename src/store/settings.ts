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

/*
 * Every option carries a full fallback stack. A bare family name silently
 * renders in the browser default when the font is missing, which is how
 * picking a monospace font used to end up proportional on machines that do
 * not ship it.
 */
export const editorFontOptions = [
  {
    id: 'Pretendard Variable',
    labelKey: 'settings.editorFont.sans',
    stack: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif',
  },
  {
    id: 'IBM Plex Sans KR',
    labelKey: 'settings.editorFont.plex',
    stack: '"IBM Plex Sans KR", "Pretendard Variable", Pretendard, -apple-system, sans-serif',
  },
  {
    id: 'monospace',
    labelKey: 'settings.editorFont.mono',
    stack: 'ui-monospace, SFMono-Regular, "SF Mono", "JetBrains Mono", Menlo, Monaco, Consolas, "D2Coding", "Liberation Mono", monospace',
  },
] as const;

export type EditorFontId = (typeof editorFontOptions)[number]['id'];

const defaultEditorFontFamily: string = editorFontOptions[0].id;

/* Legacy sessions stored raw CSS family names; map them onto the curated set. */
const legacyEditorFontAliases: Record<string, string> = {
  Pretendard: 'Pretendard Variable',
  'JetBrains Mono': 'monospace',
  'SFMono-Regular': 'monospace',
  Menlo: 'monospace',
  Monaco: 'monospace',
  'ui-monospace': 'monospace',
};

export function normalizeEditorFontFamily(family: string | undefined): string {
  if (!family) return defaultEditorFontFamily;
  const aliased = legacyEditorFontAliases[family] ?? family;
  return editorFontOptions.some((option) => option.id === aliased) ? aliased : defaultEditorFontFamily;
}

function editorFontStack(family: string): string {
  const option = editorFontOptions.find((candidate) => candidate.id === normalizeEditorFontFamily(family));
  return (option ?? editorFontOptions[0]).stack;
}

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
  /* null means "decide from the viewport", which is the shipped default. */
  setShowLineNumbers: (showLineNumbers: boolean | null) => void;
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
  document.documentElement.style.setProperty('--editor-font-family', editorFontStack(editorFontFamily));
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
  setEditorFontFamily: (requestedFontFamily) => {
    const editorFontFamily = normalizeEditorFontFamily(requestedFontFamily);
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
    const editorFontFamily = normalizeEditorFontFamily(settings.editorFontFamily);
    applyEditorSettings(fontSize, editorFontFamily);
    applyLanguage(language);
    set({
      ...settings,
      language,
      resolvedTheme,
      fontSize,
      editorFontFamily,
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
