import { useMemo, type CSSProperties } from 'react';
import type { SidebarPanelProps } from '../../app/feature';
import { getMarkdownOutline, type MarkdownOutlineItem } from '../../core/markdown/renderer';
import { useCursorPosition } from '../../hooks/useCursorPosition';
import { scrollEditorToSourceLine } from '../../hooks/useScrollSync';
import './outline.css';

export function OutlinePanel({ activeFile, textareaRef, editorScrollRef, previewRef }: SidebarPanelProps) {
  const outline = useMemo(
    () => activeFile && isMarkdownDocument(activeFile.name) ? getMarkdownOutline(activeFile.content) : [],
    [activeFile],
  );
  const cursor = useCursorPosition(activeFile?.content ?? '', textareaRef);
  const activeLine = activeOutlineLine(outline, cursor.row);

  if (!activeFile) return <div className="outline-empty">문서를 열면 아웃라인이 표시됩니다.</div>;
  if (!isMarkdownDocument(activeFile.name)) return <div className="outline-empty">Markdown 문서에서 사용할 수 있습니다.</div>;
  if (outline.length === 0) return <div className="outline-empty">문서에 제목이 없습니다.</div>;

  return (
    <nav className="outline-panel" aria-label="문서 아웃라인">
      {outline.map((item, index) => (
        <button
          aria-current={item.line === activeLine ? 'location' : undefined}
          className="outline-item"
          key={`${item.line}-${index}`}
          style={{ '--outline-level': Math.max(0, item.level - 1) } as CSSProperties}
          title={`${item.text} · ${item.line}행`}
          type="button"
          onClick={() => revealOutlineItem(item, textareaRef.current, editorScrollRef.current, previewRef.current)}
        >
          <span className="outline-level">H{item.level}</span>
          <span className="outline-title">{item.text}</span>
          <span className="outline-line">{item.line}</span>
        </button>
      ))}
    </nav>
  );
}

function activeOutlineLine(outline: readonly MarkdownOutlineItem[], cursorLine: number): number | null {
  let active: number | null = null;
  for (const item of outline) {
    if (item.line > cursorLine) break;
    active = item.line;
  }
  return active;
}

function revealOutlineItem(
  item: MarkdownOutlineItem,
  textarea: HTMLTextAreaElement | null,
  editorScroller: HTMLDivElement | null,
  preview: HTMLDivElement | null,
): void {
  if (textarea) {
    const start = indexForSourceLine(textarea.value, item.line);
    const end = textarea.value.indexOf('\n', start);
    textarea.focus();
    textarea.setSelectionRange(start, end < 0 ? textarea.value.length : end);
    textarea.dispatchEvent(new Event('select', { bubbles: true }));
    if (editorScroller) scrollEditorToSourceLine(textarea, editorScroller, item.line);
  }

  const previewHeading = preview?.querySelector<HTMLElement>(
    `h${item.level}[data-source-line="${item.line}"]`,
  );
  if (preview && previewHeading) {
    const previewBounds = preview.getBoundingClientRect();
    const headingBounds = previewHeading.getBoundingClientRect();
    preview.scrollTo({
      top: Math.max(0, preview.scrollTop + headingBounds.top - previewBounds.top - 8),
      behavior: 'smooth',
    });
  }
}

function indexForSourceLine(text: string, targetLine: number): number {
  if (targetLine <= 1) return 0;
  let line = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) !== 10) continue;
    line += 1;
    if (line === targetLine) return index + 1;
  }
  return text.length;
}

function isMarkdownDocument(name: string): boolean {
  return /\.(?:md|markdown|mdown|mkd)$/i.test(name);
}
