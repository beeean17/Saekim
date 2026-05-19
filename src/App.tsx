import { useMemo } from 'react';
import { EditorPane } from './components/editor/EditorPane';
import { PreviewPane } from './components/preview/PreviewPane';
import { AppShell } from './components/shell/AppShell';
import { Sidebar } from './components/sidebar/Sidebar';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useShortcuts } from './hooks/useShortcuts';
import { useUIStore } from './store/ui';
import { useWorkspaceStore } from './store/workspace';

export function App() {
  const openFile = useWorkspaceStore((state) => state.openFile);
  const saveActive = useWorkspaceStore((state) => state.saveActive);
  const saveActiveAs = useWorkspaceStore((state) => state.saveActiveAs);
  const openFind = useUIStore((state) => state.openFind);

  const shortcuts = useMemo(
    () => ({
      onOpen: () => void openFile(),
      onSave: () => void saveActive(),
      onSaveAs: () => void saveActiveAs(),
      onFind: openFind,
    }),
    [openFile, openFind, saveActive, saveActiveAs],
  );

  useShortcuts(shortcuts);
  useSessionPersistence();

  return (
    <AppShell>
      <main className="body">
        <Sidebar />
        <EditorPane />
        <PreviewPane />
      </main>
    </AppShell>
  );
}
