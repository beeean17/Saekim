import { useMemo } from 'react';
import katex from 'katex';
import './helper.css';
import type { EditorContribution } from '../../app/feature';
import type { KatexHelperItem } from '../../core/editor/helperTypes';
import { katexHelperItems } from './helperCatalog';

export const katexEditorContribution: EditorContribution = {
  toolbar: [
    {
      id: 'katex.helper',
      label: 'ƒx KaTeX',
      tooltip: 'KaTeX 수식 문법 찾기',
      helperMode: 'katex',
    },
  ],
  helpers: [
    {
      mode: 'katex',
      title: 'KaTeX 수식 찾기',
      placeholder: '예: 곱하기, 분수, 적분, matrix',
      description: '검색 후 문법을 선택하면 현재 커서 위치에 삽입됩니다.',
      items: katexHelperItems,
      syntax: (item) => (item as KatexHelperItem).syntax,
      snippet: (item) => {
        const helperItem = item as KatexHelperItem;
        return helperItem.displayMode ? `$$\n${helperItem.syntax}\n$$` : `$${helperItem.syntax}$`;
      },
      renderPreview: (item) => <KatexHelperPreview item={item as KatexHelperItem} />,
    },
  ],
};

function KatexHelperPreview({ item }: { item: KatexHelperItem }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(item.example, {
        displayMode: item.displayMode ?? false,
        throwOnError: false,
        errorColor: '#cc3344',
      });
    } catch {
      return '';
    }
  }, [item]);

  return (
    <div className="helper-render katex-helper-render">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <pre>{item.example}</pre>
    </div>
  );
}
