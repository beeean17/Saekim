import { useEffect } from 'react';
import type { EditorContribution, EditorOverlayProps } from '../../app/feature';
import { FindBar } from './FindBar';
import { useSearchStore } from './store';
import { translateCurrent } from '../../i18n/current';

export const searchEditorContribution: EditorContribution = {
  toolbar: [
    {
      id: 'search.find',
      icon: 'search',
      get tooltip() { return translateCurrent('search.open'); },
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
  const replaceOpen = useSearchStore((state) => state.replaceOpen);
  const closeFind = useSearchStore((state) => state.closeFind);

  useEffect(() => {
    if (!activeFile && findOpen) closeFind();
  }, [activeFile, closeFind, findOpen]);

  if (!activeFile || !findOpen) return null;

  return <FindBar file={activeFile} initialReplace={replaceOpen} textareaRef={textareaRef} onClose={closeFind} />;
}
