import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import { enabledFeatures } from '../../app/featureRegistry';
import { getFileTypeLabel } from '../../core/document/fileType';
import { useCursorPosition } from '../../hooks/useCursorPosition';
import { Backend } from '../../lib/backend';
import {
  katexHelperItems,
  markdownHelperItems,
  mermaidHelperItems,
  type KatexHelperItem,
  type MarkdownHelperItem,
  type MermaidHelperItem,
} from '../../lib/markdown/helperCatalog';
import { renderMarkdown } from '../../lib/markdown/renderer';
import { isTauriRuntime } from '../../lib/tauri/invoke';
import { useSettingsStore } from '../../store/settings';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { OpenFile } from '../../types/workspace';
import { useUIStore } from '../../store/ui';
import { Icon } from '../primitives/Icon';
import { EmptyState } from '../ui/feedback/EmptyState';
import { Dialog } from '../ui/overlay/Dialog';
import { CloseButton } from '../ui/primitives/CloseButton';
import { SearchField } from '../ui/primitives/SearchField';
import { Toolbar as UiToolbar, ToolbarButton, ToolbarGroup } from '../ui/toolbar/Toolbar';

type HelperMode = 'markdown' | 'mermaid' | 'katex';
type HelperItem = MarkdownHelperItem | KatexHelperItem | MermaidHelperItem;
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
    if (!activeFile && findOpen) closeFind();
  }, [activeFile, closeFind, findOpen]);

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
    <section className="editor-pane" data-disabled={!activeFile}>
      <EditorToolbar textareaRef={textareaRef} />
      {activeFile ? (
        <>
          {findOpen ? <FindBar content={activeFile.content} textareaRef={textareaRef} onClose={closeFind} /> : null}
          <EditorContent
            activeFile={activeFile}
            activeLine={cursor.row}
            value={activeFile.content}
            onChange={(value) => updateContent(activeFile.id, value)}
            textareaRef={textareaRef}
          />
        </>
      ) : (
        <EmptyState
          className="empty-document-state"
          title="열린 문서가 없습니다"
          description="워크스페이스에서 파일을 선택하거나 파일을 열어주세요."
        />
      )}
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
      <SearchField
        ref={inputRef}
        className="find-search-field"
        value={query}
        placeholder="현재 문서 찾기"
        onChange={setQuery}
        onEscape={() => {
          onClose();
          textareaRef.current?.focus();
        }}
        onKeyDown={(event) => {
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

function EditorToolbar({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement> }) {
  const activeFile = useWorkspaceStore(selectActiveFile);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const openFind = useUIStore((state) => state.openFind);
  const [helperMode, setHelperMode] = useState<HelperMode | null>(null);
  const disabled = !activeFile;
  const fileType = useMemo(() => (activeFile ? getFileTypeLabel(activeFile.name, activeFile.path, enabledFeatures) : '-'), [activeFile]);

  useEffect(() => {
    if (disabled) setHelperMode(null);
  }, [disabled]);

  return (
    <>
      <UiToolbar className="toolbar">
        <div className="toolbar-line-indicator" title={`현재 파일 형식: ${fileType}`} aria-label={`현재 파일 형식: ${fileType}`}>
          {fileType}
        </div>
        <ToolbarGroup className="tool-group">
          <ToolButton disabled={disabled} label="Markdown" special="markdown" tooltip="Markdown 문법 찾기" onClick={() => setHelperMode('markdown')} />
          <ToolButton disabled={disabled} label="◇ Mermaid" special="mermaid" tooltip="Mermaid 다이어그램 문법 찾기" onClick={() => setHelperMode('mermaid')} />
          <ToolButton disabled={disabled} label="ƒx KaTeX" special="katex" tooltip="KaTeX 수식 문법 찾기" onClick={() => setHelperMode('katex')} />
        </ToolbarGroup>
        <div className="tool-spacer" />
        <ToolButton disabled={disabled} icon="search" tooltip="문서 내 탐색" onClick={openFind} />
      </UiToolbar>
      {helperMode ? (
        <MarkdownHelperModal
          mode={helperMode}
          onClose={() => setHelperMode(null)}
          onInsert={(item) => {
            insertHelperItem(textareaRef.current, helperMode, item);
            setHelperMode(null);
          }}
          onImageInsert={(mode) => {
            setHelperMode(null);
            void insertSelectedImage(textareaRef.current, activeFile, mode).then(() => {
              if (mode === 'copy') void refresh();
            });
          }}
        />
      ) : null}
    </>
  );
}

interface ToolButtonProps {
  icon?: Parameters<typeof Icon>[0]['name'];
  label?: string;
  tooltip: string;
  special?: HelperMode;
  disabled?: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, tooltip, special, disabled, onClick }: ToolButtonProps) {
  return (
    <ToolbarButton className="tool-btn" data-special={special} disabled={disabled} title={tooltip} aria-label={tooltip} onClick={onClick}>
      {icon ? <Icon name={icon} /> : null}
      {label ? <span className="label">{label}</span> : null}
    </ToolbarButton>
  );
}

function MarkdownHelperModal({
  mode,
  onClose,
  onInsert,
  onImageInsert,
}: {
  mode: HelperMode;
  onClose: () => void;
  onInsert: (item: HelperItem) => void;
  onImageInsert: (mode: ImageInsertMode) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const items = helperItems(mode);
  const filteredItems = useMemo(() => searchHelperItems(items, query), [items, query]);
  const [selectedId, setSelectedId] = useState<string>(items[0]?.id ?? '');
  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const title = helperTitle(mode);
  const placeholder = helperPlaceholder(mode);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedId(filteredItems[0]?.id ?? '');
  }, [filteredItems]);

  return (
    <Dialog open title={title} className="helper-modal" backdropClassName="helper-modal-backdrop" onClose={onClose}>
        <div className="helper-modal-head">
          <div>
            <h2>{title}</h2>
            <p>{helperDescription(mode)}</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <SearchField ref={inputRef} className="helper-search" value={query} placeholder={placeholder} onChange={setQuery} />
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
                  onDoubleClick={() => onInsert(item)}
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
                  <button type="button" onClick={() => onInsert(selectedItem)}>
                    {isMarkdownHelperItem(selectedItem) && selectedItem.action ? '실행' : '삽입'}
                  </button>
                </div>
                {isMarkdownHelperItem(selectedItem) ? (
                  <>
                    <MarkdownSyntaxPreview item={selectedItem} />
                    {selectedItem.id === 'image' ? <MarkdownImageActions onImageInsert={onImageInsert} /> : null}
                  </>
                ) : isKatexHelperItem(selectedItem) ? (
                  <KatexHelperPreview item={selectedItem} />
                ) : (
                  <MermaidHelperPreview item={selectedItem} />
                )}
              </>
            ) : null}
          </div>
        </div>
    </Dialog>
  );
}

function MarkdownImageActions({ onImageInsert }: { onImageInsert: (mode: ImageInsertMode) => void }) {
  return (
    <div className="markdown-image-actions" aria-label="이미지 파일 삽입 방식">
      <button type="button" onClick={() => onImageInsert('link')}>
        <span>원본 경로로 연결</span>
        <small>파일을 이동하지 않고 현재 경로를 삽입</small>
      </button>
      <button type="button" onClick={() => onImageInsert('copy')}>
        <span>문서 assets로 복사</span>
        <small>.assets 폴더에 복사 후 상대 경로 삽입</small>
      </button>
    </div>
  );
}

function helperItems(mode: HelperMode): HelperItem[] {
  if (mode === 'markdown') return markdownHelperItems;
  if (mode === 'katex') return katexHelperItems;
  return mermaidHelperItems;
}

function helperTitle(mode: HelperMode): string {
  if (mode === 'markdown') return 'Markdown 문법 찾기';
  if (mode === 'katex') return 'KaTeX 수식 찾기';
  return 'Mermaid 다이어그램 찾기';
}

function helperPlaceholder(mode: HelperMode): string {
  if (mode === 'markdown') return '예: 제목, 볼드, 표, 체크리스트, 이미지, 줄바꿈';
  if (mode === 'katex') return '예: 곱하기, 분수, 적분, matrix';
  return '예: 순서도, 시퀀스, ERD, 간트';
}

function helperDescription(mode: HelperMode): string {
  if (mode === 'markdown') return '검색 후 문법을 선택하면 현재 커서 위치에 삽입되거나 편집 동작이 실행됩니다.';
  if (mode === 'katex') return '검색 후 문법을 선택하면 현재 커서 위치에 삽입됩니다.';
  return '템플릿을 선택하면 Mermaid 코드블럭으로 삽입됩니다.';
}

function MarkdownSyntaxPreview({ item }: { item: MarkdownHelperItem }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    let alive = true;
    void renderMarkdown(item.example, 'light').then((nextHtml) => {
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

function helperSyntax(item: HelperItem): string {
  return 'syntax' in item ? item.syntax : item.template.split('\n')[0];
}

function helperSnippet(mode: HelperMode, item: HelperItem): string {
  if (isMarkdownHelperItem(item)) return item.snippet;
  if (mode === 'mermaid' && !isKatexHelperItem(item)) return `\n\`\`\`mermaid\n${item.template}\n\`\`\`\n`;
  if (!isKatexHelperItem(item)) return item.template;

  return item.displayMode ? `$$\n${item.syntax}\n$$` : `$${item.syntax}$`;
}

function insertHelperItem(textarea: HTMLTextAreaElement | null, mode: HelperMode, item: HelperItem): void {
  if (isMarkdownHelperItem(item) && item.action) {
    indentSelectedLines(textarea, item.action === 'outdent');
    return;
  }

  insertTextAtSelection(textarea, helperSnippet(mode, item));
}

function isMarkdownHelperItem(item: HelperItem): item is MarkdownHelperItem {
  return 'snippet' in item;
}

function isKatexHelperItem(item: HelperItem): item is KatexHelperItem {
  return 'syntax' in item && !('snippet' in item);
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
  const applyIndentChange = (textarea: HTMLTextAreaElement, outdent: boolean) => {
    const change = getLineIndentChange(textarea, outdent);
    onChange(change.value);
    setTextareaValue(textarea, change.value);
    textarea.selectionStart = change.selectionStart;
    textarea.selectionEnd = change.selectionEnd;
    window.requestAnimationFrame(() => {
      const current = textareaRef.current;
      if (!current) return;
      current.selectionStart = change.selectionStart;
      current.selectionEnd = change.selectionEnd;
      updateSelectionLines(current);
    });
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
        onKeyDown={(event) => {
          const meta = event.metaKey || event.ctrlKey;

          if (event.key === 'Tab') {
            event.preventDefault();
            applyIndentChange(event.currentTarget, event.shiftKey);
            return;
          }

          if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            insertHardLineBreak(event.currentTarget);
            updateSelectionLines(event.currentTarget);
            return;
          }

          if (meta && event.key === ']') {
            event.preventDefault();
            applyIndentChange(event.currentTarget, false);
            return;
          }

          if (meta && event.key === '[') {
            event.preventDefault();
            applyIndentChange(event.currentTarget, true);
          }
        }}
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

const tabIndent = '    ';

interface LineIndentChange {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

function insertHardLineBreak(textarea: HTMLTextAreaElement | null): void {
  insertTextAtSelection(textarea, '  \n');
}

function indentSelectedLines(textarea: HTMLTextAreaElement | null, outdent: boolean): void {
  if (!textarea) return;

  const change = getLineIndentChange(textarea, outdent);
  setTextareaValue(textarea, change.value);
  textarea.selectionStart = change.selectionStart;
  textarea.selectionEnd = change.selectionEnd;
  dispatchTextareaInput(textarea);
  textarea.focus();
}

function getLineIndentChange(textarea: HTMLTextAreaElement, outdent: boolean): LineIndentChange {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);

  if (outdent) return getLineOutdentChange(value, start, end);

  if (!selected.includes('\n')) {
    return {
      value: `${value.slice(0, start)}${tabIndent}${value.slice(end)}`,
      selectionStart: start + tabIndent.length,
      selectionEnd: start + tabIndent.length,
    };
  }

  const blockStart = value.lastIndexOf('\n', start - 1) + 1;
  const selectedEnd = Math.max(start, end - 1);
  const nextLineBreak = value.indexOf('\n', selectedEnd);
  const blockEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  const block = value.slice(blockStart, blockEnd);
  const lineCount = block.split('\n').length;
  const replacement = block.replace(/^/gm, tabIndent);
  return {
    value: `${value.slice(0, blockStart)}${replacement}${value.slice(blockEnd)}`,
    selectionStart: start + tabIndent.length,
    selectionEnd: end + tabIndent.length * lineCount,
  };
}

function getLineOutdentChange(value: string, start: number, end: number): LineIndentChange {
  const blockStart = value.lastIndexOf('\n', start - 1) + 1;
  const selectedEnd = Math.max(start, end - 1);
  const nextLineBreak = value.indexOf('\n', selectedEnd);
  const blockEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  const block = value.slice(blockStart, blockEnd);
  let removedBeforeStart = 0;
  let removedBeforeEnd = 0;
  let position = blockStart;

  const replacement = block
    .split('\n')
    .map((line) => {
      const removeCount = line.startsWith(tabIndent) ? tabIndent.length : Math.min(line.match(/^ */)?.[0].length ?? 0, tabIndent.length);
      if (position < start) removedBeforeStart += Math.min(removeCount, Math.max(0, start - position));
      if (position < end) removedBeforeEnd += Math.min(removeCount, Math.max(0, end - position));
      position += line.length + 1;
      return line.slice(removeCount);
    })
    .join('\n');

  return {
    value: `${value.slice(0, blockStart)}${replacement}${value.slice(blockEnd)}`,
    selectionStart: Math.max(blockStart, start - removedBeforeStart),
    selectionEnd: Math.max(blockStart, end - removedBeforeEnd),
  };
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
