import { create } from 'zustand';
import type { SettingsSession } from '../types/session';
import type { ThemeName } from '../types/workspace';

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
  document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
  document.documentElement.style.setProperty('--editor-line-height-size', `${fontSize * 1.75}px`);
  document.documentElement.style.setProperty('--editor-font-family', editorFontFamily);
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  theme: 'default',
  fontSize: 13.5,
  editorFontFamily: 'Pretendard Variable',
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
