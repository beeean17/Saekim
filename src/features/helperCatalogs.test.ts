import { describe, expect, it } from 'vitest';
import { markdownHelperItemsFor } from './markdown/helperCatalog';
import { katexHelperItemsFor } from './katex/helperCatalog';
import { mermaidHelperItemsFor } from './mermaid/helperCatalog';

const hangul = /[가-힣]/;

/*
 * The syntax helpers are the one place where catalogue content is inserted
 * straight into the user's document. Anything shown or inserted in English mode
 * has to actually be English, or an English-speaking user ends up with Korean
 * placeholder text in their file.
 */
describe('helper catalogues in English', () => {
  it('shows no Korean in Markdown helper text or snippets', () => {
    for (const item of markdownHelperItemsFor('en')) {
      for (const [field, value] of Object.entries({
        title: item.title,
        category: item.category,
        syntax: item.syntax,
        snippet: item.snippet,
        example: item.example,
      })) {
        expect(hangul.test(value ?? ''), `markdown/${item.id}.${field}: ${value}`).toBe(false);
      }
    }
  });

  it('shows no Korean in KaTeX helper text or snippets', () => {
    for (const item of katexHelperItemsFor('en')) {
      for (const [field, value] of Object.entries({
        title: item.title,
        category: item.category,
        syntax: item.syntax,
        example: item.example,
      })) {
        expect(hangul.test(value ?? ''), `katex/${item.id}.${field}: ${value}`).toBe(false);
      }
    }
  });

  it('shows no Korean in Mermaid helper text or templates', () => {
    for (const item of mermaidHelperItemsFor('en')) {
      for (const [field, value] of Object.entries({
        title: item.title,
        category: item.category,
        template: item.template,
      })) {
        expect(hangul.test(value ?? ''), `mermaid/${item.id}.${field}: ${value}`).toBe(false);
      }
    }
  });

  it('keeps English search terms available in both languages', () => {
    /* Keywords are shared across languages, so each entry must carry at least
       one Latin-script term or English-mode search cannot reach it. */
    const catalogues = [
      ...markdownHelperItemsFor('en'),
      ...katexHelperItemsFor('en'),
      ...mermaidHelperItemsFor('en'),
    ];
    for (const item of catalogues) {
      const hasLatinKeyword = item.keywords.some((keyword) => /[a-z]/i.test(keyword));
      expect(hasLatinKeyword, `${item.id} has no English keyword`).toBe(true);
    }
  });
});
