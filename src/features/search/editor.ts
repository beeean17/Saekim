import type { EditorContribution } from '../../app/feature';

export const searchEditorContribution: EditorContribution = {
  toolbar: [
    {
      id: 'search.find',
      icon: 'search',
      tooltip: '문서 내 탐색',
      commandId: 'search.openFind',
    },
  ],
};
