import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import { useCursorPosition } from '../../hooks/useCursorPosition';
import { Backend } from '../../lib/backend';
import { getFileTypeLabel } from '../../lib/fileType';
import { katexHelperItems, mermaidHelperItems, type KatexHelperItem, type MermaidHelperItem } from '../../lib/markdown/helperCatalog';
import { useSettingsStore } from '../../store/settings';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';

type HelperMode = 'mermaid' | 'katex';
type HelperItem = KatexHelperItem | MermaidHelperItem;

export function EditorPane({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement> }) {
  const activeFile = useWorkspaceStore(selectActiveFile);
  const updateContent = useWorkspaceStore((state) => state.updateContent);
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
  const activeFile = useWorkspaceStore(selectActiveFile);
  const toolbarExpanded = useUIStore((state) => state.toolbarExpanded);
  const toggleToolbarExpanded = useUIStore((state) => state.toggleToolbarExpanded);
  const openFind = useUIStore((state) => state.openFind);
  const [helperMode, setHelperMode] = useState<HelperMode | null>(null);
  const fileType = useMemo(() => getFileTypeLabel(activeFile?.name, activeFile?.path), [activeFile?.name, activeFile?.path]);

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-line-indicator" title={`현재 파일 형식: ${fileType}`} aria-label={`현재 파일 형식: ${fileType}`}>
          {fileType}
        </div>
        <div className="tool-group">
          <ToolButton label="◇ Mermaid" special="mermaid" tooltip="Mermaid 다이어그램 문법 찾기" onClick={() => setHelperMode('mermaid')} />
          <ToolButton label="ƒx KaTeX" special="katex" tooltip="KaTeX 수식 문법 찾기" onClick={() => setHelperMode('katex')} />
        </div>
        <div className="tool-spacer" />
        <ToolButton icon="search" tooltip="문서 내 탐색" onClick={openFind} />
        <button className={`toolbar-expand ${toolbarExpanded ? 'open' : ''}`} type="button" onClick={toggleToolbarExpanded} title="모든 마크다운 도구 보기" aria-label="모든 마크다운 도구 보기">
          <Icon name="tools" className="ic" />
        </button>
      </div>
      {toolbarExpanded ? <ToolbarExpanded textareaRef={textareaRef} /> : null}
      {helperMode ? (
        <MarkdownHelperModal
          mode={helperMode}
          onClose={() => setHelperMode(null)}
          onInsert={(snippet) => {
            insertTextAtSelection(textareaRef.current, snippet);
            setHelperMode(null);
          }}
        />
      ) : null}
    </>
  );
}

function ToolbarExpanded({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement> }) {
  return (
    <div className="toolbar-expanded">
      <div className="tool-group">
        <ToolButton icon="heading1" tooltip="제목 1" onClick={() => insertMarkdown(textareaRef.current, '# ', '')} />
        <ToolButton icon="heading2" tooltip="제목 2" onClick={() => insertMarkdown(textareaRef.current, '## ', '')} />
        <ToolButton icon="heading3" tooltip="제목 3" onClick={() => insertMarkdown(textareaRef.current, '### ', '')} />
      </div>
      <div className="tool-group">
        <ToolButton icon="bold" tooltip="볼드" onClick={() => wrapSelection(textareaRef.current, '**', '**')} />
        <ToolButton icon="italic" tooltip="이탤릭" onClick={() => wrapSelection(textareaRef.current, '*', '*')} />
        <ToolButton icon="strike" tooltip="취소선" onClick={() => wrapSelection(textareaRef.current, '~~', '~~')} />
        <ToolButton icon="highlight" tooltip="강조 표시" onClick={() => wrapSelection(textareaRef.current, '==', '==')} />
        <ToolButton icon="code" tooltip="코드 블록" onClick={() => insertCodeBlock(textareaRef.current)} />
      </div>
      <div className="tool-group">
        <ToolButton icon="list" tooltip="불릿 리스트" onClick={() => insertMarkdown(textareaRef.current, '- ', '')} />
        <ToolButton icon="numberedList" tooltip="번호 리스트" onClick={() => insertMarkdown(textareaRef.current, '1. ', '')} />
        <ToolButton icon="checkList" tooltip="체크리스트" onClick={() => insertMarkdown(textareaRef.current, '- [ ] ', '')} />
      </div>
      <div className="tool-group">
        <ToolButton icon="quote" tooltip="인용" onClick={() => insertMarkdown(textareaRef.current, '> ', '')} />
        <ToolButton icon="lineBreak" tooltip="줄바꿈" onClick={() => insertMarkdown(textareaRef.current, '  \n', '')} />
        <ToolButton icon="table" tooltip="표" onClick={() => insertMarkdown(textareaRef.current, '| 제목 | 값 |\n| --- | --- |\n| 항목 | 내용 |', '')} />
        <ToolButton icon="divider" tooltip="구분선" onClick={() => insertMarkdown(textareaRef.current, '---', '')} />
      </div>
      <div className="tool-group">
        <ToolButton icon="image" tooltip="이미지" onClick={() => void insertSelectedImage(textareaRef.current)} />
        <ToolButton icon="link" tooltip="링크" onClick={() => wrapSelection(textareaRef.current, '[', '](https://)')} />
        <ToolButton icon="footnote" tooltip="각주" onClick={() => insertMarkdown(textareaRef.current, '[^1]\n\n[^1]: ', '')} />
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
    <button className="tool-btn" data-special={special} title={tooltip} aria-label={tooltip} type="button" onClick={onClick}>
      {icon ? <Icon name={icon} /> : null}
      {label ? <span className="label">{label}</span> : null}
    </button>
  );
}

function MarkdownHelperModal({
  mode,
  onClose,
  onInsert,
}: {
  mode: HelperMode;
  onClose: () => void;
  onInsert: (snippet: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const items: HelperItem[] = mode === 'katex' ? katexHelperItems : mermaidHelperItems;
  const filteredItems = useMemo(() => searchHelperItems(items, query), [items, query]);
  const [selectedId, setSelectedId] = useState<string>(items[0]?.id ?? '');
  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const title = mode === 'katex' ? 'KaTeX 수식 찾기' : 'Mermaid 다이어그램 찾기';
  const placeholder = mode === 'katex' ? '예: 곱하기, 분수, 적분, matrix' : '예: 순서도, 시퀀스, ERD, 간트';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedId(filteredItems[0]?.id ?? '');
  }, [filteredItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="helper-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="helper-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="helper-modal-head">
          <div>
            <h2>{title}</h2>
            <p>{mode === 'katex' ? '검색 후 문법을 선택하면 현재 커서 위치에 삽입됩니다.' : '템플릿을 선택하면 Mermaid 코드블럭으로 삽입됩니다.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="helper-search">
          <Icon name="search" />
          <input ref={inputRef} value={query} placeholder={placeholder} onChange={(event) => setQuery(event.currentTarget.value)} />
        </div>
        <div className="helper-modal-body">
          <div className="helper-results" role="listbox" aria-label={`${title} 결과`}>
            {filteredItems.length === 0 ? (
              <div className="helper-empty">검색 결과 없음</div>
            ) : (
              filteredItems.map((item) => (
                <button
                  className={item.id === selectedItem?.id ? 'selected' : ''}
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  onDoubleClick={() => onInsert(helperSnippet(mode, item))}
                >
                  <span className="helper-result-title">{item.title}</span>
                  <span className="helper-result-category">{item.category}</span>
                  <code>{helperSyntax(item)}</code>
                </button>
              ))
            )}
          </div>
          <div className="helper-preview">
            {selectedItem ? (
              <>
                <div className="helper-preview-head">
                  <div>
                    <span>{selectedItem.title}</span>
                    <code>{helperSyntax(selectedItem)}</code>
                  </div>
                  <button type="button" onClick={() => onInsert(helperSnippet(mode, selectedItem))}>
                    삽입
                  </button>
                </div>
                {isKatexHelperItem(selectedItem) ? <KatexHelperPreview item={selectedItem} /> : <MermaidHelperPreview item={selectedItem} />}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
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
        if (alive) setError(reason instanceof Error ? reason.message : '미리보기를 렌더링하지 못했습니다.');
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

function searchHelperItems<T extends HelperItem>(items: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;

  return items.filter((item) => {
    const fields = [item.title, item.category, ...item.keywords, helperSyntax(item)];
    return fields.some((field) => field.toLowerCase().includes(needle));
  });
}

function helperSyntax(item: KatexHelperItem | MermaidHelperItem): string {
  return 'syntax' in item ? item.syntax : item.template.split('\n')[0];
}

function helperSnippet(mode: HelperMode, item: HelperItem): string {
  if (mode === 'mermaid' && !isKatexHelperItem(item)) return `\n\`\`\`mermaid\n${item.template}\n\`\`\`\n`;
  if (!isKatexHelperItem(item)) return item.template;

  return item.displayMode ? `$$\n${item.syntax}\n$$` : `$${item.syntax}$`;
}

function isKatexHelperItem(item: HelperItem): item is KatexHelperItem {
  return 'syntax' in item;
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
  const fontSize = useSettingsStore((state) => state.fontSize);
  const editorFontFamily = useSettingsStore((state) => state.editorFontFamily);
  const editorContentRef = useRef<HTMLDivElement | null>(null);
  const lineNumberListRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef(0);
  const latestScrollTopRef = useRef(0);
  const [selectionLines, setSelectionLines] = useState<{ start: number; end: number } | null>(null);
  const lineCount = Math.max(1, value.split('\n').length);
  const updateSelectionLines = (textarea: HTMLTextAreaElement) => {
    setSelectionLines(getSelectionLines(textarea));
  };
  const syncLineNumbers = (scrollTop: number) => {
    latestScrollTopRef.current = scrollTop;
    if (scrollFrameRef.current) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = 0;
      if (lineNumberListRef.current) {
        lineNumberListRef.current.style.transform = `translateY(${-latestScrollTopRef.current}px)`;
      }
    });
  };

  useEffect(
    () => () => {
      if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const root = editorContentRef.current;
    const textarea = textareaRef.current;
    if (!root || !textarea) return;

    const syncMeasuredLineHeight = () => {
      const computedStyle = window.getComputedStyle(textarea);
      const fontSizePx = Number.parseFloat(computedStyle.fontSize);
      const lineHeightRatio = Number.parseFloat(computedStyle.getPropertyValue('--editor-line-height')) || 1.75;
      const rawLineHeight = fontSizePx * lineHeightRatio;
      if (!Number.isFinite(rawLineHeight) || rawLineHeight <= 0) return;

      root.style.setProperty('--editor-row-height', `${Math.ceil(rawLineHeight)}px`);
      syncLineNumbers(textarea.scrollTop);
    };

    syncMeasuredLineHeight();
    const resizeObserver = new ResizeObserver(syncMeasuredLineHeight);
    resizeObserver.observe(textarea);
    void document.fonts?.ready.then(syncMeasuredLineHeight);

    return () => resizeObserver.disconnect();
  }, [editorFontFamily, fontSize, textareaRef]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const syncSelection = () => {
      if (document.activeElement !== textarea) {
        setSelectionLines(null);
        return;
      }
      updateSelectionLines(textarea);
    };

    document.addEventListener('selectionchange', syncSelection);
    textarea.addEventListener('blur', syncSelection);
    return () => {
      document.removeEventListener('selectionchange', syncSelection);
      textarea.removeEventListener('blur', syncSelection);
    };
  }, [textareaRef]);

  return (
    <div className="editor-content" ref={editorContentRef}>
      <div className="line-numbers">
        <div className="line-number-list" ref={lineNumberListRef}>
          {Array.from({ length: lineCount }, (_, index) => {
            const line = index + 1;
            const selected = Boolean(selectionLines && line >= selectionLines.start && line <= selectionLines.end);
            return (
              <span className={`${line === activeLine ? 'active' : ''} ${selected ? 'selected' : ''}`.trim()} key={index}>
                <span className="line-number-text">{line}</span>
              </span>
            );
          })}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={value}
        spellCheck={false}
        wrap="off"
        onScroll={(event) => syncLineNumbers(event.currentTarget.scrollTop)}
        onSelect={(event) => updateSelectionLines(event.currentTarget)}
        onKeyUp={(event) => updateSelectionLines(event.currentTarget)}
        onMouseUp={(event) => updateSelectionLines(event.currentTarget)}
        onChange={(event) => {
          onChange(event.currentTarget.value);
          updateSelectionLines(event.currentTarget);
        }}
      />
    </div>
  );
}

function getSelectionLines(textarea: HTMLTextAreaElement): { start: number; end: number } | null {
  const start = Math.min(textarea.selectionStart, textarea.selectionEnd);
  const end = Math.max(textarea.selectionStart, textarea.selectionEnd);

  if (start === end) return null;

  const selectedEnd = Math.max(start, end - 1);
  const startLine = getLineNumberAtIndex(textarea.value, start);
  const endLine = getLineNumberAtIndex(textarea.value, selectedEnd);
  return { start: startLine, end: Math.max(startLine, endLine) };
}

function getLineNumberAtIndex(text: string, index: number): number {
  let line = 1;
  const clampedIndex = Math.max(0, Math.min(index, text.length));

  for (let i = 0; i < clampedIndex; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }

  return line;
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

function insertCodeBlock(textarea: HTMLTextAreaElement | null): void {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);
  const before = '```\n';
  const after = selected && !selected.endsWith('\n') ? '\n```' : '```';
  const replacement = `${before}${selected}${after}`;
  const selectionStart = start + before.length;
  const selectionEnd = selectionStart + selected.length;

  replaceSelectionUndoably(textarea, replacement);
  textarea.selectionStart = selectionStart;
  textarea.selectionEnd = selectionEnd;
}

async function insertSelectedImage(textarea: HTMLTextAreaElement | null): Promise<void> {
  if (!textarea) return;

  const path = await Backend.pickImagePath();
  if (!path) {
    textarea.focus();
    return;
  }

  insertTextAtSelection(textarea, markdownImageSnippet(path));
}

function markdownImageSnippet(path: string): string {
  const name = fileNameFromPath(path);
  const alt = name.replace(/\.[^.]+$/, '') || '이미지';
  return `![${alt}](<${escapeMarkdownDestination(path)}>)`;
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? 'image';
}

function escapeMarkdownDestination(path: string): string {
  return path.replace(/\\/g, '/').replace(/>/g, '%3E');
}

function insertTextAtSelection(textarea: HTMLTextAreaElement | null, snippet: string): void {
  if (!textarea) return;
  const start = textarea.selectionStart;

  replaceSelectionUndoably(textarea, snippet);
  textarea.selectionStart = start + snippet.length;
  textarea.selectionEnd = start + snippet.length;
}

function wrapSelection(textarea: HTMLTextAreaElement | null, before: string, after: string): void {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);

  replaceSelectionUndoably(textarea, `${before}${selected}${after}`);
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = end + before.length;
}

function replaceSelectionUndoably(textarea: HTMLTextAreaElement, replacement: string): void {
  textarea.focus();

  try {
    if (document.execCommand('insertText', false, replacement)) {
      dispatchTextareaInput(textarea);
      return;
    }
  } catch {
    // Fallback below keeps non-browser test/runtime environments working.
  }

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  setTextareaValue(textarea, next);
  dispatchTextareaInput(textarea);
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (valueSetter) {
    valueSetter.call(textarea, value);
    return;
  }

  textarea.value = value;
}

function dispatchTextareaInput(textarea: HTMLTextAreaElement): void {
  const event =
    typeof InputEvent === 'function'
      ? new InputEvent('input', { bubbles: true, inputType: 'insertText' })
      : new Event('input', { bubbles: true });

  textarea.dispatchEvent(event);
}
