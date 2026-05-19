import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Backend } from '../lib/backend';
import type { SettingsSession } from '../types/session';
import type { ThemeName } from '../types/workspace';

interface SettingsState {
  theme: ThemeName;
  fontSize: number;
  editorFontFamily: string;
  setTheme: (theme: ThemeName) => void;
  restoreSettings: (settings: SettingsSession) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'default',
      fontSize: 13.5,
      editorFontFamily: 'JetBrains Mono',
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        void Backend.setTheme(theme);
        set({ theme });
      },
      restoreSettings: (settings) => {
        document.documentElement.setAttribute('data-theme', settings.theme);
        set(settings);
      },
    }),
    {
      name: 'saekim-settings',
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        editorFontFamily: state.editorFontFamily,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          document.documentElement.setAttribute('data-theme', state.theme);
        }
      },
    },
  ),
);
