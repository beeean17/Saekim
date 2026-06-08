import { useEffect } from 'react';
import type { EditorContribution, EditorOverlayProps } from '../../app/feature';
import { FindBar } from './FindBar';
import { useSearchStore } from './store';

export const searchEditorContribution: EditorContribution = {
  toolbar: [
    {
      id: 'search.find',
      icon: 'search',
      tooltip: '문서 내 탐색',
      commandId: 'search.openFind',
    },
  ],
  overlays: [
    {
      id: 'search.find-bar',
      component: SearchFindOverlay,
    },
  ],
};

function SearchFindOverlay({ activeFile, textareaRef }: EditorOverlayProps) {
  const findOpen = useSearchStore((state) => state.findOpen);
  const closeFind = useSearchStore((state) => state.closeFind);

  useEffect(() => {
    if (!activeFile && findOpen) closeFind();
  }, [activeFile, closeFind, findOpen]);

  if (!activeFile || !findOpen) return null;

  return <FindBar content={activeFile.content} textareaRef={textareaRef} onClose={closeFind} />;
}
