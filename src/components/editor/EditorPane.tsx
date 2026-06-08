import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { dispatchCommand, type CommandRegistry } from '../../app/commands';
import type { EditorEventHandlers, EditorHandlerContext, EditorHelperContribution } from '../../app/feature';
import { enabledFeatures } from '../../app/featureRegistry';
import { EditorHelperModal } from '../../core/editor/EditorHelperModal';
import type { EditorHelperItemBase } from '../../core/editor/helperTypes';
import { selectEditorContributions } from '../../core/editor/registry';
import { getLineIndentChange, indentSelectedLines, insertHardLineBreak, insertTextAtSelection, setTextareaValue } from '../../core/editor/textEditing';
import { getFileTypeLabel } from '../../core/document/fileType';
import { FindBar, useSearchStore } from '../../features/search';
import { useCursorPosition } from '../../hooks/useCursorPosition';
import { useSettingsStore } from '../../store/settings';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { Icon } from '../primitives/Icon';
import { EmptyState } from '../ui/feedback/EmptyState';
import { Toolbar as UiToolbar, ToolbarButton, ToolbarGroup } from '../ui/toolbar/Toolbar';

type IconName = Parameters<typeof Icon>[0]['name'];

export function EditorPane({ textareaRef, commandRegistry }: { textareaRef: RefObject<HTMLTextAreaElement>; commandRegistry: CommandRegistry }) {
  const activeFile = useWorkspaceStore(selectActiveFile);
  const updateContent = useWorkspaceStore((state) => state.updateContent);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const cursor = useCursorPosition(activeFile?.content ?? '', textareaRef.current);
  const findOpen = useSearchStore((state) => state.findOpen);
  const closeFind = useSearchStore((state) => state.closeFind);
  const editorContributions = useMemo(() => selectEditorContributions(enabledFeatures), []);
  const handlerContext = useMemo<EditorHandlerContext>(
    () => ({
      activeFile,
      textareaRef,
      refreshWorkspace: () => void refresh(),
    }),
    [activeFile, refresh, textareaRef],
  );

  useEffect(() => {
    if (!activeFile && findOpen) closeFind();
  }, [activeFile, closeFind, findOpen]);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      for (const handler of editorContributions.handlers) {
        handler.windowDragOver?.(event, handlerContext);
        if (event.defaultPrevented) return;
      }
    };

    const onDrop = (event: DragEvent) => {
      for (const handler of editorContributions.handlers) {
        handler.windowDrop?.(event, handlerContext);
        if (event.defaultPrevented) return;
      }
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [editorContributions.handlers, handlerContext]);

  return (
    <section className="editor-pane" data-disabled={!activeFile}>
      <EditorToolbar commandRegistry={commandRegistry} contributions={editorContributions} textareaRef={textareaRef} />
      {activeFile ? (
        <>
          {findOpen ? <FindBar content={activeFile.content} textareaRef={textareaRef} onClose={closeFind} /> : null}
          <EditorContent
            activeLine={cursor.row}
            value={activeFile.content}
            onChange={(value) => updateContent(activeFile.id, value)}
            editorHandlers={editorContributions.handlers}
            handlerContext={handlerContext}
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

function EditorToolbar({
  commandRegistry,
  contributions,
  textareaRef,
}: {
  commandRegistry: CommandRegistry;
  contributions: ReturnType<typeof selectEditorContributions>;
  textareaRef: RefObject<HTMLTextAreaElement>;
}) {
  const activeFile = useWorkspaceStore(selectActiveFile);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const [helperMode, setHelperMode] = useState<string | null>(null);
  const disabled = !activeFile;
  const fileType = useMemo(() => (activeFile ? getFileTypeLabel(activeFile.name, activeFile.path, enabledFeatures) : '-'), [activeFile]);
  const activeHelper = contributions.helpers.find((helper) => helper.mode === helperMode) ?? null;
  const imageActions = contributions.imageActions[0] ?? null;

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
          {contributions.toolbar.map((item) => (
            <ToolButton
              disabled={disabled}
              icon={item.icon as IconName | undefined}
              key={item.id}
              label={item.label}
              special={item.helperMode}
              tooltip={item.tooltip}
              onClick={() => {
                if (item.helperMode) setHelperMode(item.helperMode);
                if (item.commandId) dispatchCommand(commandRegistry, item.commandId);
              }}
            />
          ))}
        </ToolbarGroup>
      </UiToolbar>
      {activeHelper ? (
        <EditorHelperModal
          helper={activeHelper}
          onClose={() => setHelperMode(null)}
          onInsert={(helper, item) => {
            insertHelperItem(textareaRef.current, helper, item);
            setHelperMode(null);
          }}
          onImageInsert={(mode) => {
            setHelperMode(null);
            void imageActions?.insertSelectedImage(textareaRef.current, activeFile, mode).then(() => {
              if (mode === 'copy') void refresh();
            });
          }}
        />
      ) : null}
    </>
  );
}

interface ToolButtonProps {
  icon?: IconName;
  label?: string;
  tooltip: string;
  special?: string;
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

function insertHelperItem(textarea: HTMLTextAreaElement | null, helper: EditorHelperContribution, item: EditorHelperItemBase): void {
  const action = helper.action?.(item);
  if (action) {
    indentSelectedLines(textarea, action === 'outdent');
    return;
  }

  insertTextAtSelection(textarea, helper.snippet(item));
}

function EditorContent({
  value,
  onChange,
  textareaRef,
  activeLine,
  editorHandlers,
  handlerContext,
}: {
  value: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  activeLine: number;
  editorHandlers: EditorEventHandlers[];
  handlerContext: EditorHandlerContext;
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
          for (const handler of editorHandlers) {
            handler.textareaDragOver?.(event, handlerContext);
            if (event.defaultPrevented) return;
          }
        }}
        onDrop={(event) => {
          for (const handler of editorHandlers) {
            handler.textareaDrop?.(event, handlerContext);
            if (event.defaultPrevented) return;
          }
        }}
        onPaste={(event) => {
          for (const handler of editorHandlers) {
            handler.paste?.(event, handlerContext);
            if (event.defaultPrevented) return;
          }
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
