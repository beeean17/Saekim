import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import katex from 'katex';
import { useCursorPosition } from '../../hooks/useCursorPosition';
import { Backend } from '../../lib/backend';
import { getFileTypeLabel } from '../../lib/fileType';
import { katexHelperItems, mermaidHelperItems, type KatexHelperItem, type MermaidHelperItem } from '../../lib/markdown/helperCatalog';
import { isTauriRuntime } from '../../lib/tauri/invoke';
import { useSettingsStore } from '../../store/settings';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { OpenFile } from '../../types/workspace';
import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';

type HelperMode = 'mermaid' | 'katex';
type HelperItem = KatexHelperItem | MermaidHelperItem;
type ImageInsertMode = 'link' | 'copy';
type DroppedImage =
  | { type: 'remote'; url: string }
  | { type: 'file'; file: File };

const MAX_DROPPED_IMAGE_BYTES = 20 * 1024 * 1024;

interface ImageDownloadProgressPayload {
  id: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  progress: number | null;
  message?: string;
}

export function EditorPane({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement> }) {
  const activeFile = useWorkspaceStore(selectActiveFile);
  const updateContent = useWorkspaceStore((state) => state.updateContent);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const cursor = useCursorPosition(activeFile?.content ?? '', textareaRef.current);
  const findOpen = useUIStore((state) => state.findOpen);
  const closeFind = useUIStore((state) => state.closeFind);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer || !hasPotentialImageDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };

    const onDrop = (event: DragEvent) => {
      if (event.defaultPrevented || !event.dataTransfer) return;
      if (!hasPotentialImageDrop(event.dataTransfer)) return;
      const droppedImage = getDroppedImage(event.dataTransfer);

      const textarea = textareaRef.current;
      if (!textarea) return;

      event.preventDefault();
      event.stopPropagation();
      textarea.focus();
      if (droppedImage) {
        void insertDroppedImage(textarea, activeFile, droppedImage).then(() => void refresh());
      } else {
        insertDroppedImageHelp(textarea);
      }
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [activeFile, refresh, textareaRef]);

  return (
    <section className="editor-pane">
      <Toolbar textareaRef={textareaRef} />
      {findOpen ? <FindBar content={activeFile?.content ?? ''} textareaRef={textareaRef} onClose={closeFind} /> : null}
      <EditorContent
        activeFile={activeFile}
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
  const activeFile = useWorkspaceStore(selectActiveFile);

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
        <ImageToolButton activeFile={activeFile} textareaRef={textareaRef} />
        <ToolButton icon="link" tooltip="링크" onClick={() => wrapSelection(textareaRef.current, '[', '](https://)')} />
        <ToolButton icon="footnote" tooltip="각주" onClick={() => insertMarkdown(textareaRef.current, '[^1]\n\n[^1]: ', '')} />
      </div>
    </div>
  );
}

function ImageToolButton({
  activeFile,
  textareaRef,
}: {
  activeFile: OpenFile | null;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}) {
  const refresh = useWorkspaceStore((state) => state.refresh);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = () => {
    const root = rootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    const menuWidth = 218;
    setMenuPosition({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
    });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  const insert = (mode: ImageInsertMode) => {
    setOpen(false);
    void insertSelectedImage(textareaRef.current, activeFile, mode).then(() => {
      if (mode === 'copy') void refresh();
    });
  };

  return (
    <div className="tool-dropdown" ref={rootRef}>
      <button
        className={`tool-btn ${open ? 'active' : ''}`}
        type="button"
        title="이미지"
        aria-label="이미지"
        onClick={() => {
          updateMenuPosition();
          setOpen((state) => !state);
        }}
      >
        <Icon name="image" />
      </button>
      {open && menuPosition
        ? createPortal(
            <div
              className="tool-menu"
              ref={menuRef}
              role="menu"
              aria-label="이미지 삽입 방식"
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
          <button type="button" role="menuitem" onClick={() => insert('link')}>
            <span>원본 경로로 연결</span>
            <small>파일을 이동하지 않고 현재 경로를 삽입</small>
          </button>
          <button type="button" role="menuitem" onClick={() => insert('copy')}>
            <span>문서 assets로 복사</span>
            <small>.assets 폴더에 복사 후 상대 경로 삽입</small>
          </button>
            </div>,
            document.body,
          )
        : null}
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
  activeFile,
  value,
  onChange,
  textareaRef,
  activeLine,
}: {
  activeFile: OpenFile | null;
  value: string;
  onChange: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  activeLine: number;
}) {
  const fontSize = useSettingsStore((state) => state.fontSize);
  const editorFontFamily = useSettingsStore((state) => state.editorFontFamily);
  const editorContentRef = useRef<HTMLDivElement | null>(null);
  const lineNumberListRef = useRef<HTMLDivElement | null>(null);
  const refresh = useWorkspaceStore((state) => state.refresh);
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
        onDragOver={(event) => {
          if (!hasPotentialImageDrop(event.dataTransfer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(event) => {
          if (!hasPotentialImageDrop(event.dataTransfer)) return;
          const droppedImage = getDroppedImage(event.dataTransfer);
          event.preventDefault();
          event.stopPropagation();
          if (droppedImage) {
            void insertDroppedImage(event.currentTarget, activeFile, droppedImage).then(() => void refresh());
          } else {
            insertDroppedImageHelp(event.currentTarget);
          }
        }}
        onPaste={(event) => {
          const imageFile = getClipboardImageFile(event.clipboardData);
          if (!imageFile) return;

          event.preventDefault();
          event.stopPropagation();
          void insertPastedImageFile(event.currentTarget, activeFile, imageFile).then(() => void refresh());
        }}
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

async function insertSelectedImage(textarea: HTMLTextAreaElement | null, activeFile: OpenFile | null, mode: ImageInsertMode): Promise<void> {
  if (!textarea) return;

  let currentFilePath = '';
  if (mode === 'copy') {
    try {
      currentFilePath = requireSavedActiveFile(activeFile);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '이미지를 assets로 가져오려면 먼저 현재 문서를 저장해야 합니다.');
      textarea.focus();
      return;
    }
  }

  const path = await Backend.pickImagePath();
  if (!path) {
    textarea.focus();
    return;
  }

  if (mode === 'link') {
    insertTextAtSelection(textarea, markdownImageSnippet(path));
    return;
  }

  try {
    const assetPath = await Backend.copyImageToAssets(path, currentFilePath);
    insertTextAtSelection(textarea, markdownImageSnippet(assetPath));
  } catch (error) {
    console.error('이미지 복사 실패:', error);
    window.alert(error instanceof Error ? error.message : '이미지 복사에 실패했습니다.');
    textarea.focus();
  }
}

async function insertDroppedRemoteImage(textarea: HTMLTextAreaElement, activeFile: OpenFile | null, imageUrl: string): Promise<void> {
  let currentFilePath = '';
  try {
    currentFilePath = requireSavedActiveFile(activeFile);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '이미지를 assets로 가져오려면 먼저 현재 문서를 저장해야 합니다.');
    textarea.focus();
    return;
  }

  const id = `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pendingMarker = pendingImageSnippet(id, 0);
  insertTextAtSelection(textarea, pendingMarker);

  let unlisten: (() => void) | null = null;
  try {
    if (isTauriRuntime()) {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<ImageDownloadProgressPayload>('image-download-progress', (event) => {
        if (event.payload.id !== id || event.payload.status !== 'progress') return;
        replacePendingImageMarker(textarea, id, pendingImageSnippet(id, event.payload.progress));
      });
    }

    const assetPath = await Backend.downloadImageToAssets(id, imageUrl, currentFilePath);
    replacePendingImageMarker(textarea, id, markdownImageSnippet(assetPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : '이미지 다운로드에 실패했습니다.';
    console.error('이미지 다운로드 실패:', error);
    replacePendingImageMarker(textarea, id, failedImageSnippet(id, message));
  } finally {
    unlisten?.();
    textarea.focus();
  }
}

async function insertDroppedImage(textarea: HTMLTextAreaElement, activeFile: OpenFile | null, droppedImage: DroppedImage): Promise<void> {
  if (droppedImage.type === 'remote') {
    await insertDroppedRemoteImage(textarea, activeFile, droppedImage.url);
    return;
  }

  await insertDroppedImageFile(textarea, activeFile, droppedImage.file);
}

async function insertDroppedImageFile(textarea: HTMLTextAreaElement, activeFile: OpenFile | null, file: File): Promise<void> {
  await insertImageFileFromBytes(textarea, activeFile, file, {
    fileName: file.name || null,
    selectAltAfterInsert: false,
  });
}

async function insertPastedImageFile(textarea: HTMLTextAreaElement, activeFile: OpenFile | null, file: File): Promise<void> {
  await insertImageFileFromBytes(textarea, activeFile, file, {
    fileName: clipboardImageFileName(file),
    selectAltAfterInsert: true,
  });
}

async function insertImageFileFromBytes(
  textarea: HTMLTextAreaElement,
  activeFile: OpenFile | null,
  file: File,
  options: { fileName: string | null; selectAltAfterInsert: boolean },
): Promise<void> {
  let currentFilePath = '';
  try {
    currentFilePath = requireSavedActiveFile(activeFile);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '이미지를 assets로 가져오려면 먼저 현재 문서를 저장해야 합니다.');
    textarea.focus();
    return;
  }

  if (file.size > MAX_DROPPED_IMAGE_BYTES) {
    window.alert('이미지는 20MB 이하만 가져올 수 있습니다.');
    textarea.focus();
    return;
  }

  const id = `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  insertTextAtSelection(textarea, pendingImageSnippet(id, null));

  try {
    const bytes = await fileToByteArray(file);
    const assetPath = await Backend.importImageBytesToAssets(bytes, options.fileName, file.type || null, currentFilePath);
    if (options.selectAltAfterInsert) {
      replacePendingImageMarkerWithSelectedAlt(textarea, id, assetPath);
    } else {
      replacePendingImageMarker(textarea, id, markdownImageSnippet(assetPath));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '이미지 가져오기에 실패했습니다.';
    console.error('이미지 가져오기 실패:', error);
    replacePendingImageMarker(textarea, id, failedImageSnippet(id, message));
  } finally {
    textarea.focus();
  }
}

function insertDroppedImageHelp(textarea: HTMLTextAreaElement): void {
  insertTextAtSelection(
    textarea,
    failedImageSnippet(
      `help-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      '이미지 주소를 찾지 못했습니다. 검색 결과나 게시글 링크는 이미지로 가져올 수 없습니다. 이미지 우클릭 후 이미지 주소 복사를 사용하거나, 이미지 버튼의 URL 가져오기를 사용하세요.',
    ),
  );
}

function markdownImageSnippet(path: string, altText?: string): string {
  const name = fileNameFromPath(path);
  const alt = altText ?? (name.replace(/\.[^.]+$/, '') || '이미지');
  return `![${alt}](<${escapeMarkdownDestination(path)}>)`;
}

function pendingImageSnippet(id: string, progress: number | null): string {
  const label = progress === null ? '이미지 다운로드 중' : `이미지 다운로드 중 ${progress}%`;
  return `![${label}](saekim-pending-image://${id})`;
}

function failedImageSnippet(id: string, message: string): string {
  return `![이미지 다운로드 실패: ${escapeMarkdownAlt(message)}](saekim-failed-image://${id})`;
}

function requireSavedActiveFile(activeFile: OpenFile | null): string {
  if (!activeFile || activeFile.path.startsWith('~') || activeFile.path.startsWith('browser://')) {
    throw new Error('이미지를 assets로 가져오려면 먼저 현재 문서를 저장해야 합니다.');
  }
  return activeFile.path;
}

function extractRemoteImageUrl(dataTransfer: DataTransfer): string | null {
  const uri = dataTransfer.getData('text/uri-list').split('\n').find((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#');
  });
  const plain = dataTransfer.getData('text/plain').trim();
  const html = dataTransfer.getData('text/html');
  const htmlSrc = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ?? '';
  const cssUrl = html.match(/url\(["']?([^"')]+)["']?\)/i)?.[1] ?? '';

  return [uri, htmlSrc, cssUrl, plain].map((value) => value?.trim() ?? '').find(isRemoteHttpUrl) ?? null;
}

function getDroppedImage(dataTransfer: DataTransfer): DroppedImage | null {
  const imageUrl = extractRemoteImageUrl(dataTransfer);
  if (imageUrl) return { type: 'remote', url: imageUrl };

  const imageFile = extractDroppedImageFile(dataTransfer);
  return imageFile ? { type: 'file', file: imageFile } : null;
}

function extractDroppedImageFile(dataTransfer: DataTransfer): File | null {
  const files = Array.from(dataTransfer.files);
  const imageFile = files.find((file) => isImageFile(file));
  if (imageFile) return imageFile;

  const items = Array.from(dataTransfer.items);
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file && isImageFile(file)) return file;
  }

  return null;
}

function getClipboardImageFile(clipboardData: DataTransfer): File | null {
  const items = Array.from(clipboardData.items);
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file && isImageFile(file)) return file;
  }

  return Array.from(clipboardData.files).find((file) => isImageFile(file)) ?? null;
}

function hasPotentialImageDrop(dataTransfer: DataTransfer): boolean {
  const types = Array.from(dataTransfer.types);
  if (['text/uri-list', 'text/html'].some((type) => types.includes(type))) return true;
  return Array.from(dataTransfer.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(?:png|jpe?g|gif|webp|bmp|ico|avif)$/i.test(file.name);
}

async function fileToByteArray(file: File): Promise<number[]> {
  const buffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}

function clipboardImageFileName(file: File): string {
  if (file.name && file.name.trim()) return file.name;

  return `clipboard-image-${formatClipboardTimestamp(new Date())}.${imageExtensionFromMime(file.type)}`;
}

function formatClipboardTimestamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function imageExtensionFromMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/avif':
      return 'avif';
    case 'image/svg+xml':
      return 'svg';
    case 'image/bmp':
      return 'bmp';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return 'ico';
    case 'image/png':
    default:
      return 'png';
  }
}

function isRemoteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? 'image';
}

function escapeMarkdownDestination(path: string): string {
  return path.replace(/\\/g, '/').replace(/>/g, '%3E');
}

function escapeMarkdownAlt(value: string): string {
  return value.replace(/]/g, '\\]');
}

function replacePendingImageMarker(textarea: HTMLTextAreaElement, id: string, replacement: string): void {
  const markerPattern = new RegExp(`!\\[[^\\]]*\\]\\(saekim-(?:pending|failed)-image://${escapeRegExp(id)}\\)`);
  const match = textarea.value.match(markerPattern);
  if (!match || match.index === undefined) return;

  replaceTextRange(textarea, match.index, match.index + match[0].length, replacement);
}

function replacePendingImageMarkerWithSelectedAlt(textarea: HTMLTextAreaElement, id: string, assetPath: string): void {
  const markerPattern = new RegExp(`!\\[[^\\]]*\\]\\(saekim-(?:pending|failed)-image://${escapeRegExp(id)}\\)`);
  const match = textarea.value.match(markerPattern);
  if (!match || match.index === undefined) return;

  const altText = 'image';
  const replacement = markdownImageSnippet(assetPath, altText);
  const start = match.index;
  replaceTextRange(textarea, start, start + match[0].length, replacement);
  textarea.focus();
  textarea.selectionStart = start + 2;
  textarea.selectionEnd = start + 2 + altText.length;
}

function replaceTextRange(textarea: HTMLTextAreaElement, start: number, end: number, replacement: string): void {
  const value = textarea.value;
  const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const delta = replacement.length - (end - start);

  setTextareaValue(textarea, next);
  textarea.selectionStart = adjustSelectionIndex(selectionStart, start, end, delta);
  textarea.selectionEnd = adjustSelectionIndex(selectionEnd, start, end, delta);
  dispatchTextareaInput(textarea);
}

function adjustSelectionIndex(index: number, start: number, end: number, delta: number): number {
  if (index <= start) return index;
  if (index >= end) return index + delta;
  return start;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
