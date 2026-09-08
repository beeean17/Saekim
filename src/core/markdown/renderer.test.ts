import { describe, expect, it } from 'vitest';
import { getMarkdownOutline, renderMarkdown } from './renderer';

describe('Markdown renderer', () => {
  it('tracks source lines and readable heading text', () => {
    expect(getMarkdownOutline('# First *section*\n\n## Second')).toEqual([
      { level: 1, line: 1, endLine: 1, text: 'First section' },
      { level: 2, line: 3, endLine: 3, text: 'Second' },
    ]);
  });

  it('renders source anchors, task lists, and escaped raw HTML', async () => {
    const html = await renderMarkdown('# Title\n\n- [x] done\n\n<script>alert(1)</script>');

    expect(html).toContain('<h1 data-source-line="1" data-source-end-line="1">Title</h1>');
    expect(html).toContain('task-list-item-checkbox');
    expect(html).toContain('checked');
    expect(html).not.toContain('<script>');
  });
});
