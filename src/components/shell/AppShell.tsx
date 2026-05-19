import type { ReactNode } from 'react';
import { useUIStore } from '../../store/ui';
import { Header } from './Header';
import { StatusBar } from './StatusBar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const sidebarMode = useUIStore((state) => state.sidebarMode);
  const viewMode = useUIStore((state) => state.viewMode);

  return (
    <div className="app" data-sidebar={sidebarMode} data-view={viewMode}>
      <Header />
      {children}
      <StatusBar />
    </div>
  );
}
