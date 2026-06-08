import { useEffect, useState } from 'react';
import './helper.css';
import type { EditorContribution } from '../../app/feature';
import type { MermaidHelperItem } from '../../core/editor/helperTypes';
import { mermaidHelperItems } from './helperCatalog';

export const mermaidEditorContribution: EditorContribution = {
  toolbar: [
    {
      id: 'mermaid.helper',
      label: '◇ Mermaid',
      tooltip: 'Mermaid 다이어그램 문법 찾기',
      helperMode: 'mermaid',
    },
  ],
  helpers: [
    {
      mode: 'mermaid',
      title: 'Mermaid 다이어그램 찾기',
      placeholder: '예: 순서도, 시퀀스, ERD, 간트',
      description: '템플릿을 선택하면 Mermaid 코드블럭으로 삽입됩니다.',
      items: mermaidHelperItems,
      syntax: (item) => (item as MermaidHelperItem).template.split('\n')[0],
      snippet: (item) => `\n\`\`\`mermaid\n${(item as MermaidHelperItem).template}\n\`\`\`\n`,
      renderPreview: (item) => <MermaidHelperPreview item={item as MermaidHelperItem} />,
    },
  ],
};

function MermaidHelperPreview({ item }: { item: MermaidHelperItem }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const id = `helper-mermaid-${item.id}-${Date.now()}`;

    setHtml('');
    setError('');
    void import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
        const { svg } = await mermaid.render(id, item.template);
        if (alive) setHtml(svg);
      })
      .catch((reason) => {
        if (alive) setError(reason instanceof Error ? reason.message : '미리보기를 렌더링하지 못했습니다.');
      });

    return () => {
      alive = false;
    };
  }, [item]);

  return (
    <div className="helper-render mermaid-helper-render">
      {error ? <pre>{error}</pre> : null}
      {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{item.template}</pre>}
    </div>
  );
}
