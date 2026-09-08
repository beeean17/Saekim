import { afterEach, describe, expect, it } from 'vitest';
import { translate } from './messages';
import { useSettingsStore } from '../store/settings';
import { markdownHelperItemsFor } from '../features/markdown/helperCatalog';
import { katexHelperItemsFor } from '../features/katex/helperCatalog';
import { mermaidHelperItemsFor } from '../features/mermaid/helperCatalog';

afterEach(() => {
  useSettingsStore.getState().setLanguage('ko');
});

describe('translations', () => {
  it('renders Korean and English messages with interpolation', () => {
    expect(translate('ko', 'document.words', { count: 12 })).toBe('12 단어');
    expect(translate('en', 'document.words', { count: 12 })).toBe('12 words');
    expect(translate('en', 'external.description', { name: 'notes.md' })).toContain('notes.md');
  });

  it('applies the selected language to the document', () => {
    useSettingsStore.getState().setLanguage('en');

    expect(useSettingsStore.getState().language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('falls back to Korean when restoring a legacy session', () => {
    useSettingsStore.getState().setLanguage('en');
    useSettingsStore.getState().restoreSettings({
      theme: 'system',
      fontSize: 13.5,
      editorFontFamily: 'Pretendard Variable',
    });

    expect(useSettingsStore.getState().language).toBe('ko');
    expect(document.documentElement.lang).toBe('ko');
  });

  it('localizes helper titles and inserted examples', () => {
    expect(markdownHelperItemsFor('en').find((item) => item.id === 'task-list')).toMatchObject({
      title: 'Checklist',
      snippet: '- [ ] To do',
    });
    expect(katexHelperItemsFor('en').find((item) => item.id === 'fraction')?.syntax).toContain('numerator');
    expect(mermaidHelperItemsFor('en').find((item) => item.id === 'flowchart-td')?.template).toContain('Start');
  });
});
