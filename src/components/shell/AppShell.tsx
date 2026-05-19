import type { CSSProperties, ReactNode } from 'react';
import { useUIStore } from '../../store/ui';
import { Header } from './Header';
import { SettingsPanel } from './SettingsPanel';
import { StatusBar } from './StatusBar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const viewMode = useUIStore((state) => state.viewMode);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const splitRatio = useUIStore((state) => state.splitRatio);
  const layoutStyle = {
    '--sidebar-w': `${sidebarWidth}px`,
    '--editor-fr': `${splitRatio}fr`,
    '--preview-fr': `${1 - splitRatio}fr`,
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
