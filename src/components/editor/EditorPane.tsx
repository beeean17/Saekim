import { useRef, useState } from 'react';
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

  return (
    <section className="editor-pane">
      <Toolbar textareaRef={textareaRef} />
      <EditorContent
        activeLine={cursor.row}
        value={activeFile?.content ?? ''}
        onChange={(value) => activeFile && updateContent(activeFile.id, value)}
        textareaRef={textareaRef}
      />
    </section>
  );
}

function Toolbar({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement> }) {
  const toolbarExpanded = useUIStore((state) => state.toolbarExpanded);
  const toggleToolbarExpanded = useUIStore((state) => state.toggleToolbarExpanded);
  const saveActive = useWorkspaceStore((state) => state.saveActive);

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
