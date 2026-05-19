import { useMemo } from 'react';
import { EditorPane } from './components/editor/EditorPane';
import { PreviewPane } from './components/preview/PreviewPane';
import { AppShell } from './components/shell/AppShell';
import { Sidebar } from './components/sidebar/Sidebar';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useShortcuts } from './hooks/useShortcuts';
import { useUIStore } from './store/ui';
import { isDirty, selectActiveFile, useWorkspaceStore } from './store/workspace';

export function App() {
  const openFile = useWorkspaceStore((state) => state.openFile);
  const saveActive = useWorkspaceStore((state) => state.saveActive);
  const saveActiveAs = useWorkspaceStore((state) => state.saveActiveAs);
  const closeFile = useWorkspaceStore((state) => state.closeFile);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const openFind = useUIStore((state) => state.openFind);

  const shortcuts = useMemo(
    () => ({
      onOpen: () => void openFile(),
      onSave: () => void saveActive(),
      onSaveAs: () => void saveActiveAs(),
      onFind: openFind,
      onClose: () => {
        if (!activeFile) return;
        if (isDirty(activeFile) && !window.confirm(`${activeFile.name} 파일의 저장되지 않은 변경사항을 버리고 닫을까요?`)) return;
        closeFile(activeFile.id);
      },
    }),
    [activeFile, closeFile, openFile, openFind, saveActive, saveActiveAs],
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
