import { useEffect, type CSSProperties, type ReactNode } from 'react';
import type { CommandRegistry } from '../../app/commands';
import { useViewportProfile } from '../../hooks/useViewportProfile';
import { Backend } from '../../platform/common/backend';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { Header, type AppMenuHandlers } from './Header';
import { SettingsPanel } from './SettingsPanel';
import { StatusBar } from './StatusBar';

interface AppShellProps {
  children: ReactNode;
  menuHandlers: AppMenuHandlers;
  commandRegistry: CommandRegistry;
}

export function AppShell({ children, menuHandlers, commandRegistry }: AppShellProps) {
  useNativeWindowChrome();
  const viewportProfile = useViewportProfile();
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
    <div
      className="app"
      data-sidebar={sidebarMode}
      data-view={viewMode}
      data-viewport-profile={viewportProfile.profile}
      style={layoutStyle}
    >
      <Header menuHandlers={menuHandlers} commandRegistry={commandRegistry} />
      <SettingsPanel />
      {children}
      <StatusBar />
    </div>
  );
}

function useNativeWindowChrome(): void {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    const hasWindowChrome = currentPlatformCapabilities().has('window.chrome');
    document.documentElement.classList.toggle('tauri-window-chrome', hasWindowChrome);
    if (!hasWindowChrome) return;

    const titlebarColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-surface')
      .trim();
    if (!titlebarColor) return;

    void Backend.runtime.setWindowBackgroundColor(titlebarColor).catch((error) => {
      console.warn('Failed to sync native titlebar color:', error);
    });
  }, [theme]);
}
