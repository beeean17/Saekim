import { useEffect, useMemo, useRef, useState } from 'react';
import { useCursorPosition } from '../../hooks/useCursorPosition';
import { exportPreviewToPdf } from '../../lib/pdf/export';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';

export function EditorPane() {
  const activeFile = useWorkspaceStore(selectActiveFile);
  const updateContent = useWorkspaceStore((state) => state.updateContent);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cursor = useCursorPosition(activeFile?.content ?? '', textareaRef.current);
  const findOpen = useUIStore((state) => state.findOpen);
  const closeFind = useUIStore((state) => state.closeFind);

  return (
    <section className="editor-pane">
      <Toolbar textareaRef={textareaRef} />
      {findOpen ? <FindBar content={activeFile?.content ?? ''} textareaRef={textareaRef} onClose={closeFind} /> : null}
      <EditorContent
        activeLine={cursor.row}
        value={activeFile?.content ?? ''}
        onChange={(value) => activeFile && updateContent(activeFile.id, value)}
        textareaRef={textareaRef}
      />
    </section>
  );
}

function FindBar({
  content,
  textareaRef,
  onClose,
}: {
  content: string;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = useMemo(() => findMatches(content, query), [content, query]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (matches.length === 0) return;
    const match = matches[activeIndex % matches.length];
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);
    inputRef.current?.focus();
  }, [activeIndex, matches, textareaRef]);

  const go = (direction: 1 | -1) => {
    if (matches.length === 0) return;
    setActiveIndex((index) => (index + direction + matches.length) % matches.length);
  };

  return (
    <div className="find-bar">
      <Icon name="search" />
      <input
        ref={inputRef}
        value={query}
        placeholder="현재 문서 찾기"
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            textareaRef.current?.focus();
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            go(event.shiftKey ? -1 : 1);
          }
        }}
      />
      <span className="find-count">
        {matches.length > 0 ? `${(activeIndex % matches.length) + 1}/${matches.length}` : query ? '0/0' : '-'}
      </span>
      <button type="button" title="이전 결과" onClick={() => go(-1)}>
        <Icon name="chevronUp" />
      </button>
      <button type="button" title="다음 결과" onClick={() => go(1)}>
        <Icon name="chevronDown" />
      </button>
      <button className="find-close" type="button" onClick={onClose}>
        닫기
      </button>
    </div>
  );
}

function Toolbar({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement> }) {
  const toolbarExpanded = useUIStore((state) => state.toolbarExpanded);
  const toggleToolbarExpanded = useUIStore((state) => state.toggleToolbarExpanded);
  const saveActive = useWorkspaceStore((state) => state.saveActive);
  const saveActiveAs = useWorkspaceStore((state) => state.saveActiveAs);

  return (
    <>
      <div className="toolbar">
        <div className="tool-group">
          <ToolButton icon="undo" tooltip="실행 취소" onClick={() => textareaRef.current?.focus()} />
          <ToolButton icon="redo" tooltip="다시 실행" onClick={() => textareaRef.current?.focus()} />
        </div>
        <div className="tool-group">
          <ToolButton icon="heading" tooltip="제목" onClick={() => insertMarkdown(textareaRef.current, '## ', '')} />
          <ToolButton icon="bold" tooltip="볼드" onClick={() => wrapSelection(textareaRef.current, '**', '**')} />
          <ToolButton icon="italic" tooltip="이탤릭" onClick={() => wrapSelection(textareaRef.current, '*', '*')} />
        </div>
        <div className="tool-group">
          <ToolButton icon="link" tooltip="링크" onClick={() => wrapSelection(textareaRef.current, '[', '](https://)')} />
          <ToolButton icon="code" tooltip="코드 블록" onClick={() => insertMarkdown(textareaRef.current, '```\\n', '\\n```')} />
        </div>
        <div className="tool-group">
          <ToolButton label="◇ Mermaid" special="mermaid" tooltip="Mermaid 다이어그램" onClick={() => insertMarkdown(textareaRef.current, '```mermaid\\nflowchart LR\\n  A --> B\\n', '\\n```')} />
          <ToolButton label="ƒx KaTeX" special="katex" tooltip="KaTeX 수식" onClick={() => wrapSelection(textareaRef.current, '$', '$')} />
        </div>
        <div className="tool-spacer" />
        <button className="toolbar-expand" type="button" onClick={() => void exportPreviewToPdf()} title="PDF 내보내기">
          PDF
        </button>
        <button className="toolbar-expand" type="button" onClick={() => void saveActive()} title="저장">
          저장
        </button>
        <button className="toolbar-expand" type="button" onClick={() => void saveActiveAs()} title="다른 이름으로 저장">
          다른 이름 저장
        </button>
        <button className={`toolbar-expand ${toolbarExpanded ? 'open' : ''}`} type="button" onClick={toggleToolbarExpanded} title="모든 마크다운 도구 보기">
          <span>모든 도구</span>
          <Icon name="chevronDown" className="ic chev" />
        </button>
      </div>
      {toolbarExpanded ? <ToolbarExpanded textareaRef={textareaRef} /> : null}
    </>
  );
}

function ToolbarExpanded({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement> }) {
  return (
    <div className="toolbar-expanded">
      <div className="tool-group">
        <ToolButton label="H1" tooltip="제목 1" onClick={() => insertMarkdown(textareaRef.current, '# ', '')} />
        <ToolButton label="H2" tooltip="제목 2" onClick={() => insertMarkdown(textareaRef.current, '## ', '')} />
        <ToolButton label="H3" tooltip="제목 3" onClick={() => insertMarkdown(textareaRef.current, '### ', '')} />
      </div>
      <div className="tool-group">
        <ToolButton icon="strike" tooltip="취소선" onClick={() => wrapSelection(textareaRef.current, '~~', '~~')} />
        <ToolButton icon="highlight" tooltip="강조 표시" onClick={() => wrapSelection(textareaRef.current, '==', '==')} />
        <ToolButton icon="code" tooltip="인라인 코드" onClick={() => wrapSelection(textareaRef.current, '`', '`')} />
      </div>
      <div className="tool-group">
        <ToolButton icon="list" tooltip="불릿 리스트" onClick={() => insertMarkdown(textareaRef.current, '- ', '')} />
        <ToolButton icon="numberedList" tooltip="번호 리스트" onClick={() => insertMarkdown(textareaRef.current, '1. ', '')} />
        <ToolButton icon="checkList" tooltip="체크리스트" onClick={() => insertMarkdown(textareaRef.current, '- [ ] ', '')} />
      </div>
      <div className="tool-group">
        <ToolButton icon="quote" tooltip="인용" onClick={() => insertMarkdown(textareaRef.current, '> ', '')} />
        <ToolButton icon="table" tooltip="표" onClick={() => insertMarkdown(textareaRef.current, '| 제목 | 값 |\\n| --- | --- |\\n| 항목 | 내용 |', '')} />
        <ToolButton icon="divider" tooltip="구분선" onClick={() => insertMarkdown(textareaRef.current, '\\n---\\n', '')} />
      </div>
      <div className="tool-group">
        <ToolButton icon="image" tooltip="이미지" onClick={() => insertMarkdown(textareaRef.current, '![설명](', ')')} />
        <ToolButton icon="link" tooltip="링크" onClick={() => wrapSelection(textareaRef.current, '[', '](https://)')} />
        <ToolButton icon="footnote" tooltip="각주" onClick={() => insertMarkdown(textareaRef.current, '[^1]\\n\\n[^1]: ', '')} />
      </div>
    </div>
  );
}

interface ToolButtonProps {
  icon?: Parameters<typeof Icon>[0]['name'];
  label?: string;
  tooltip: string;
  special?: 'mermaid' | 'katex';
  onClick: () => void;
}

function ToolButton({ icon, label, tooltip, special, onClick }: ToolButtonProps) {
  return (
    <button className="tool-btn" data-special={special} title={tooltip} type="button" onClick={onClick}>
      {icon ? <Icon name={icon} /> : null}
      {label ? <span className="label">{label}</span> : null}
    </button>
  );
}

function EditorContent({
  value,
  onChange,
  textareaRef,
  activeLine,
}: {
  value: string;
  onChange: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  activeLine: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const lineCount = Math.max(1, value.split('\n').length);

  return (
    <div className="editor-content">
      <div className="line-numbers" style={{ transform: `translateY(${-scrollTop}px)` }}>
        {Array.from({ length: lineCount }, (_, index) => (
          <span className={index + 1 === activeLine ? 'active' : ''} key={index}>
            {index + 1}
          </span>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={value}
        spellCheck={false}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

function findMatches(content: string, query: string): Array<{ start: number; end: number }> {
  const needle = query.trim();
  if (!needle) return [];

  const matches: Array<{ start: number; end: number }> = [];
  const haystack = content.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let index = haystack.indexOf(lowerNeedle);

  while (index !== -1) {
    matches.push({ start: index, end: index + lowerNeedle.length });
    index = haystack.indexOf(lowerNeedle, index + lowerNeedle.length);
  }

  return matches;
}

function insertMarkdown(textarea: HTMLTextAreaElement | null, before: string, after: string): void {
  wrapSelection(textarea, before, after);
}

function wrapSelection(textarea: HTMLTextAreaElement | null, before: string, after: string): void {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const next = `${value.slice(0, start)}${before}${value.slice(start, end)}${after}${value.slice(end)}`;
  textarea.value = next;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = end + before.length;
}
