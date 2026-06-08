import { useEffect, useState } from 'react';
import './helper.css';
import type { EditorContribution, EditorHelperPreviewContext } from '../../app/feature';
import { Button } from '../../components/ui/primitives/Button';
import type { MarkdownHelperItem } from '../../core/editor/helperTypes';
import { renderMarkdown } from '../../lib/markdown/renderer';
import { markdownHelperItems } from './helperCatalog';

export const markdownEditorContribution: EditorContribution = {
  toolbar: [
    {
      id: 'markdown.helper',
      label: 'Markdown',
      tooltip: 'Markdown 문법 찾기',
      helperMode: 'markdown',
    },
  ],
  helpers: [
    {
      mode: 'markdown',
      title: 'Markdown 문법 찾기',
      placeholder: '예: 제목, 볼드, 표, 체크리스트, 이미지, 줄바꿈',
      description: '검색 후 문법을 선택하면 현재 커서 위치에 삽입되거나 편집 동작이 실행됩니다.',
      items: markdownHelperItems,
      syntax: (item) => (item as MarkdownHelperItem).syntax,
      snippet: (item) => (item as MarkdownHelperItem).snippet,
      action: (item) => (item as MarkdownHelperItem).action ?? null,
      insertLabel: (item) => ((item as MarkdownHelperItem).action ? '실행' : '삽입'),
      renderPreview: (item, ctx) => <MarkdownSyntaxPreview item={item as MarkdownHelperItem} ctx={ctx} />,
    },
  ],
};

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
  return (
    <div className="markdown-image-actions" aria-label="이미지 파일 삽입 방식">
      <Button className="markdown-image-action" onClick={() => onImageInsert('link')}>
        <span>원본 경로로 연결</span>
        <small>파일을 이동하지 않고 현재 경로를 삽입</small>
      </Button>
      <Button className="markdown-image-action" onClick={() => onImageInsert('copy')}>
        <span>문서 assets로 복사</span>
        <small>.assets 폴더에 복사 후 상대 경로 삽입</small>
      </Button>
    </div>
  );
}
