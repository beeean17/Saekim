import { useMemo } from 'react';
import katex from 'katex';
import './helper.css';
import type { EditorContribution } from '../../app/feature';
import type { KatexHelperItem } from '../../core/editor/helperTypes';
import { katexHelperItemsFor } from './helperCatalog';
import { translate, type TranslationKey } from '../../i18n/messages';
import { useSettingsStore } from '../../store/settings';

export const katexEditorContribution: EditorContribution = {
  toolbar: [
    {
      id: 'katex.helper',
      label: 'ƒx KaTeX',
      get tooltip() { return currentText('helper.katex.tooltip'); },
      helperMode: 'katex',
    },
  ],
  helpers: [
    {
      mode: 'katex',
      get title() { return currentText('helper.katex.title'); },
      get placeholder() { return currentText('helper.katex.placeholder'); },
      get description() { return currentText('helper.katex.description'); },
      get items() { return katexHelperItemsFor(useSettingsStore.getState().language); },
      syntax: (item) => (item as KatexHelperItem).syntax,
      snippet: (item) => {
        const helperItem = item as KatexHelperItem;
        return helperItem.displayMode ? `$$\n${helperItem.syntax}\n$$` : `$${helperItem.syntax}$`;
      },
      renderPreview: (item) => <KatexHelperPreview item={item as KatexHelperItem} />,
    },
  ],
};

function currentText(key: TranslationKey): string {
  return translate(useSettingsStore.getState().language, key);
}

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
