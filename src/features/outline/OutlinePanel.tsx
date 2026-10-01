import { scrollBehavior } from '../../core/motion';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { SidebarPanelProps } from '../../app/feature';
import { getMarkdownOutline, type MarkdownOutlineItem } from '../../core/markdown/renderer';
import { useCursorPosition } from '../../hooks/useCursorPosition';
import { scrollEditorToSourceLine } from '../../hooks/useScrollSync';
import { Icon } from '../../components/primitives/Icon';
import './outline.css';
import { useI18n } from '../../i18n/useI18n';

export interface OutlineTreeNode {
  item: MarkdownOutlineItem;
  children: OutlineTreeNode[];
}

export function OutlinePanel({ activeFile, textareaRef, editorScrollRef, previewRef }: SidebarPanelProps) {
  const { t } = useI18n();
  const outline = useMemo(
    () => activeFile && isMarkdownDocument(activeFile.name) ? getMarkdownOutline(activeFile.content) : [],
    [activeFile],
  );
  const tree = useMemo(() => buildOutlineTree(outline), [outline]);
  const [collapsedLines, setCollapsedLines] = useState<ReadonlySet<number>>(() => new Set());
  const cursor = useCursorPosition(activeFile?.content ?? '', textareaRef);
  const activeLine = activeOutlineLine(outline, cursor.row);

  useEffect(() => {
    setCollapsedLines(new Set());
  }, [activeFile?.id]);

  if (!activeFile) return <div className="outline-empty">{t('outline.empty')}</div>;
  if (!isMarkdownDocument(activeFile.name)) return <div className="outline-empty">{t('outline.markdownOnly')}</div>;
  if (outline.length === 0) return <div className="outline-empty">{t('outline.noHeadings')}</div>;

  return (
    <nav className="outline-panel" aria-label={t('outline.aria')}>
      <OutlineTree
        activeLine={activeLine}
        collapsedLines={collapsedLines}
        editorScrollRef={editorScrollRef}
        nodes={tree}
        previewRef={previewRef}
        textareaRef={textareaRef}
        onToggle={(line) => {
          setCollapsedLines((current) => {
            const next = new Set(current);
            if (next.has(line)) next.delete(line);
            else next.add(line);
            return next;
          });
        }}
      />
    </nav>
  );
}

function OutlineTree({
  activeLine,
  collapsedLines,
  editorScrollRef,
  nodes,
  previewRef,
  textareaRef,
  onToggle,
  nested = false,
}: {
  activeLine: number | null;
  collapsedLines: ReadonlySet<number>;
  editorScrollRef: RefObject<HTMLDivElement>;
  nodes: readonly OutlineTreeNode[];
  previewRef: RefObject<HTMLDivElement>;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onToggle: (line: number) => void;
  nested?: boolean;
}) {
  const { t } = useI18n();
  return (
    <ul className={`outline-tree ${nested ? 'outline-children' : ''}`} role={nested ? 'group' : 'tree'}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const expanded = hasChildren && !collapsedLines.has(node.item.line);
        return (
          <li
            aria-expanded={hasChildren ? expanded : undefined}
            key={`${node.item.line}-${node.item.level}`}
            role="treeitem"
          >
            <div className="outline-row">
              {hasChildren ? (
                <button
                  aria-expanded={expanded}
                  aria-label={t(expanded ? 'outline.collapse' : 'outline.expand', { text: node.item.text })}
                  className="outline-toggle"
                  type="button"
                  onClick={() => onToggle(node.item.line)}
                >
                  <Icon className="outline-chevron" name="chevronRight" />
                </button>
              ) : <span className="outline-toggle-spacer" />}
              <button
                aria-current={node.item.line === activeLine ? 'location' : undefined}
                className="outline-item"
                title={t('outline.line', { text: node.item.text, line: node.item.line })}
                type="button"
                onClick={() => revealOutlineItem(node.item, textareaRef.current, editorScrollRef.current, previewRef.current)}
              >
                <span className="outline-level">H{node.item.level}</span>
                <span className="outline-title">{node.item.text}</span>
                <span className="outline-line">{node.item.line}</span>
              </button>
            </div>
            {expanded ? (
              <OutlineTree
                activeLine={activeLine}
                collapsedLines={collapsedLines}
                editorScrollRef={editorScrollRef}
                nodes={node.children}
                previewRef={previewRef}
                textareaRef={textareaRef}
                onToggle={onToggle}
                nested
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function buildOutlineTree(outline: readonly MarkdownOutlineItem[]): OutlineTreeNode[] {
  const roots: OutlineTreeNode[] = [];
  const ancestors: OutlineTreeNode[] = [];

  for (const item of outline) {
    while (ancestors.length > 0 && ancestors[ancestors.length - 1].item.level >= item.level) {
      ancestors.pop();
    }
    const node: OutlineTreeNode = { item, children: [] };
    const parent = ancestors[ancestors.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    ancestors.push(node);
  }

  return roots;
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
      behavior: scrollBehavior(),
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
