import { create } from 'zustand';
import type { SettingsSession } from '../types/session';
import type { ThemeName } from '../types/workspace';

const defaultFontSize = 13.5;
const defaultEditorFontFamily = 'Pretendard Variable';

interface SettingsState {
  theme: ThemeName;
  fontSize: number;
  editorFontFamily: string;
  setTheme: (theme: ThemeName) => void;
  setFontSize: (fontSize: number) => void;
  setEditorFontFamily: (editorFontFamily: string) => void;
  restoreSettings: (settings: SettingsSession) => void;
}

function applyEditorSettings(fontSize: number, editorFontFamily: string): void {
  if (typeof document === 'undefined') return;

  document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
  document.documentElement.style.setProperty('--editor-font-family', editorFontFamily);
}

applyEditorSettings(defaultFontSize, defaultEditorFontFamily);

export const useSettingsStore = create<SettingsState>()((set) => ({
  theme: 'default',
  fontSize: defaultFontSize,
  editorFontFamily: defaultEditorFontFamily,
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  setFontSize: (fontSize) => {
    set((state) => {
      applyEditorSettings(fontSize, state.editorFontFamily);
      return { fontSize };
    });
  },
  setEditorFontFamily: (editorFontFamily) => {
    set((state) => {
      applyEditorSettings(state.fontSize, editorFontFamily);
      return { editorFontFamily };
    });
  },
  restoreSettings: (settings) => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    applyEditorSettings(settings.fontSize, settings.editorFontFamily);
    set(settings);
  },
}));
