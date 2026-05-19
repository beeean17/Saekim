import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setNativeTheme } from '../lib/tauri/theme';
import type { ThemeName } from '../types/workspace';

interface SettingsState {
  theme: ThemeName;
  fontSize: number;
  editorFontFamily: string;
  setTheme: (theme: ThemeName) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'default',
      fontSize: 13.5,
      editorFontFamily: 'JetBrains Mono',
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        void setNativeTheme(theme);
        set({ theme });
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
