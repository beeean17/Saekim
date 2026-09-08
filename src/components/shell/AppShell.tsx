import { useEffect, useMemo, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { CommandRegistry } from '../../app/commands';
import { enabledFeatures } from '../../app/featureRegistry';
import { selectAppOverlays } from '../../core/app/registry';
import type { ViewportProfileSnapshot } from '../../hooks/useViewportProfile';
import { Backend } from '../../platform/common/backend';
import { Platform } from '../../platform/common/platform';
import { useSettingsStore, useSystemTheme } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import type { ViewMode } from '../../types/workspace';
import { Header } from './Header';
import { SettingsPanel } from './SettingsPanel';
import { StatusBar } from './StatusBar';

const COLLAPSED_SIDEBAR_WIDTH = 56;

interface AppShellProps {
  children: ReactNode;
  commandRegistry: CommandRegistry;
  viewportProfile: ViewportProfileSnapshot;
  effectiveViewMode: ViewMode;
  availableViewModes: readonly ViewMode[];
  textareaRef: RefObject<HTMLTextAreaElement>;
}

export function AppShell({
  children,
  commandRegistry,
  viewportProfile,
  effectiveViewMode,
  availableViewModes,
  textareaRef,
}: AppShellProps) {
  useSystemTheme();
  useNativeWindowChrome();
  const runtime = Platform.shellRuntime;
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const compactSidebarOpen = useUIStore((state) => state.compactSidebarOpen);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const splitRatio = useUIStore((state) => state.splitRatio);
  const editorWidth = useUIStore((state) => state.editorWidth);
  const appOverlays = useMemo(() => selectAppOverlays(enabledFeatures), []);
  const showLineNumbers = useSettingsStore((state) => state.showLineNumbers);
  const visibleSidebarWidth = sidebarMode === 'collapsed' ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth;
  const layoutStyle = {
    '--sidebar-w': `${sidebarWidth}px`,
    '--sidebar-current-w': `${visibleSidebarWidth}px`,
    '--editor-fr': `${splitRatio}fr`,
    '--preview-fr': `${1 - splitRatio}fr`,
    '--editor-w': `${editorWidth}px`,
  } as CSSProperties;

  return (
    <div
      className="app"
      data-runtime={runtime}
      data-line-numbers={showLineNumbers === null ? 'auto' : showLineNumbers ? 'visible' : 'hidden'}
      data-sidebar={sidebarMode}
      data-compact-sidebar={compactSidebarOpen ? 'open' : 'closed'}
      data-view={effectiveViewMode}
      data-viewport-profile={viewportProfile.profile}
      style={layoutStyle}
    >
      <Header
        commandRegistry={commandRegistry}
        effectiveViewMode={effectiveViewMode}
        availableViewModes={availableViewModes}
      />
      <SettingsPanel
        compact={viewportProfile.profile === 'compact'}
        effectiveViewMode={effectiveViewMode}
        availableViewModes={availableViewModes}
      />
      {appOverlays.map((overlay) => {
        const Overlay = overlay.component;
        return <Overlay commandRegistry={commandRegistry} key={overlay.id} />;
      })}
      {children}
      <StatusBar textareaRef={textareaRef} />
    </div>
  );
}

function useNativeWindowChrome(): void {
  const resolvedTheme = useSettingsStore((state) => state.resolvedTheme);

  useEffect(() => {
    const hasWindowChrome = Platform.capabilities.has('window.chrome');
    document.documentElement.classList.toggle('tauri-window-chrome', hasWindowChrome);
    if (!hasWindowChrome || !Platform.windowChrome.syncsNativeTitlebarColor) return;

    const titlebarColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-surface')
      .trim();
    if (!titlebarColor) return;

    void Backend.runtime.setWindowBackgroundColor(titlebarColor).catch((error) => {
      console.warn('Failed to sync native titlebar color:', error);
    });
  }, [resolvedTheme]);
}
