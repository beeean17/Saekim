import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { Header } from './Header';
import { SettingsPanel } from './SettingsPanel';
import { StatusBar } from './StatusBar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  useNativeWindowChrome();
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const viewMode = useUIStore((state) => state.viewMode);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const splitRatio = useUIStore((state) => state.splitRatio);
  const editorWidth = useUIStore((state) => state.editorWidth);
  const layoutStyle = {
    '--sidebar-w': `${sidebarWidth}px`,
    '--editor-fr': `${splitRatio}fr`,
    '--preview-fr': `${1 - splitRatio}fr`,
    '--editor-w': `${editorWidth}px`,
  } as CSSProperties;

  return (
    <div className="app" data-sidebar={sidebarMode} data-view={viewMode} style={layoutStyle}>
      <Header />
      <SettingsPanel />
      {children}
      <StatusBar />
    </div>
  );
}

function useNativeWindowChrome(): void {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    const isTauri = '__TAURI_INTERNALS__' in window;
    document.documentElement.classList.toggle('tauri-window-chrome', isTauri);
    if (!isTauri) return;

    const titlebarColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-surface')
      .trim();
    if (!titlebarColor) return;

    void getCurrentWebviewWindow().setBackgroundColor(titlebarColor).catch((error) => {
      console.warn('Failed to sync native titlebar color:', error);
    });
  }, [theme]);
}
