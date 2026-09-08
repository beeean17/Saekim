import { useEffect, useState } from 'react';
import './helper.css';
import type { EditorContribution } from '../../app/feature';
import type { MermaidHelperItem } from '../../core/editor/helperTypes';
import { mermaidHelperItemsFor } from './helperCatalog';
import { translate, type TranslationKey } from '../../i18n/messages';
import { useSettingsStore } from '../../store/settings';

export const mermaidEditorContribution: EditorContribution = {
  toolbar: [
    {
      id: 'mermaid.helper',
      label: '◇ Mermaid',
      get tooltip() { return currentText('helper.mermaid.tooltip'); },
      helperMode: 'mermaid',
    },
  ],
  helpers: [
    {
      mode: 'mermaid',
      get title() { return currentText('helper.mermaid.title'); },
      get placeholder() { return currentText('helper.mermaid.placeholder'); },
      get description() { return currentText('helper.mermaid.description'); },
      get items() { return mermaidHelperItemsFor(useSettingsStore.getState().language); },
      syntax: (item) => (item as MermaidHelperItem).template.split('\n')[0],
      snippet: (item) => `\n\`\`\`mermaid\n${(item as MermaidHelperItem).template}\n\`\`\`\n`,
      renderPreview: (item) => <MermaidHelperPreview item={item as MermaidHelperItem} />,
    },
  ],
};

function currentText(key: TranslationKey): string {
  return translate(useSettingsStore.getState().language, key);
}

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
        if (alive) setError(reason instanceof Error ? reason.message : currentText('helper.previewFailed'));
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
