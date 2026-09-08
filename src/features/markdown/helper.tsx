import { useEffect, useState } from 'react';
import './helper.css';
import type { EditorContribution, EditorHelperPreviewContext } from '../../app/feature';
import { Button } from '../../components/ui/primitives/Button';
import type { MarkdownHelperItem } from '../../core/editor/helperTypes';
import { renderMarkdown } from '../../core/markdown/renderer';
import { markdownHelperItemsFor } from './helperCatalog';
import { translate, type TranslationKey } from '../../i18n/messages';
import { useSettingsStore } from '../../store/settings';

export const markdownEditorContribution: EditorContribution = {
  toolbar: [
    {
      id: 'markdown.helper',
      label: 'Markdown',
      get tooltip() { return currentText('helper.markdown.tooltip'); },
      helperMode: 'markdown',
    },
  ],
  helpers: [
    {
      mode: 'markdown',
      get title() { return currentText('helper.markdown.title'); },
      get placeholder() { return currentText('helper.markdown.placeholder'); },
      get description() { return currentText('helper.markdown.description'); },
      get items() { return markdownHelperItemsFor(useSettingsStore.getState().language); },
      syntax: (item) => (item as MarkdownHelperItem).syntax,
      snippet: (item) => (item as MarkdownHelperItem).snippet,
      action: (item) => (item as MarkdownHelperItem).action ?? null,
      insertLabel: (item) => currentText((item as MarkdownHelperItem).action ? 'common.run' : 'common.insert'),
      renderPreview: (item, ctx) => <MarkdownSyntaxPreview item={item as MarkdownHelperItem} ctx={ctx} />,
    },
  ],
};

function currentText(key: TranslationKey): string {
  return translate(useSettingsStore.getState().language, key);
}

function MarkdownSyntaxPreview({ item, ctx }: { item: MarkdownHelperItem; ctx: EditorHelperPreviewContext }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    let alive = true;
    void renderMarkdown(item.example, { theme: 'light' }).then((nextHtml) => {
      if (alive) setHtml(nextHtml);
    });
    return () => {
      alive = false;
    };
  }, [item]);

  return (
    <div className="helper-render markdown-helper-render">
      <div className="markdown-helper-preview" dangerouslySetInnerHTML={{ __html: html }} />
      <pre>{item.example}</pre>
      {item.id === 'image' && ctx.onImageInsert ? <MarkdownImageActions onImageInsert={ctx.onImageInsert} /> : null}
    </div>
  );
}

function MarkdownImageActions({ onImageInsert }: { onImageInsert: NonNullable<EditorHelperPreviewContext['onImageInsert']> }) {
  const { language } = useSettingsStore();
  const t = (key: TranslationKey) => translate(language, key);
  return (
    <div className="markdown-image-actions" aria-label={t('image.insertMode')}>
      <Button className="markdown-image-action" onClick={() => onImageInsert('link')}>
        <span>{t('image.linkOriginal')}</span>
        <small>{t('image.linkOriginalHint')}</small>
      </Button>
      <Button className="markdown-image-action" onClick={() => onImageInsert('copy')}>
        <span>{t('image.copyAssets')}</span>
        <small>{t('image.copyAssetsHint')}</small>
      </Button>
    </div>
  );
}
