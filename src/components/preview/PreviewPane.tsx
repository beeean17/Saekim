import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Backend } from '../../lib/backend';
import { getFileTypeInfo } from '../../lib/fileType';
import { renderBrowserHtmlDocument, renderSafeHtmlDocument } from '../../lib/html/renderHtml';
import { escapeHtml } from '../../lib/markdown/escape';
import { renderMarkdown } from '../../lib/markdown/renderer';
import { isExternalUrl, openExternalUrl } from '../../lib/tauri/opener';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { BlockKind, BlockLayout, LayoutAlign } from '../../types/metadata';
import { Icon } from '../primitives/Icon';
import { StructuredDataPreview, TabularDataPreview } from './StructuredDataPreview';

export function PreviewPane({ previewRef }: { previewRef: React.MutableRefObject<HTMLDivElement | null> }) {
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const htmlPreviewMode = useSettingsStore((state) => state.htmlPreviewMode);
  const setHtmlPreviewMode = useSettingsStore((state) => state.setHtmlPreviewMode);
  const isHtmlPreview = getFileTypeInfo(activeFile?.name, activeFile?.path).previewKind === 'html';

  return (
    <section className="preview-pane">
      <div className="preview-head">
        <span className="label">미리보기</span>
        {isHtmlPreview ? (
          <div className="html-preview-mode" aria-label="HTML 미리보기 모드">
            <button
              className={htmlPreviewMode === 'browser' ? 'active' : ''}
              type="button"
              title="브라우저처럼 보기"
              onClick={() => setHtmlPreviewMode('browser')}
            >
              브라우저
            </button>
            <button
              className={htmlPreviewMode === 'safe' ? 'active' : ''}
              type="button"
              title="안전하게 보기"
              onClick={() => setHtmlPreviewMode('safe')}
            >
              안전
            </button>
          </div>
        ) : null}
        <button
          className={`preview-action ${syncScroll ? 'active' : ''}`}
          title={syncScroll ? '스크롤 동기화 풀기' : '스크롤 동기화'}
          type="button"
          onClick={toggleSyncScroll}
        >
          <Icon name={syncScroll ? 'link' : 'unlink'} />
        </button>
      </div>
      <PreviewContent previewRef={previewRef} />
    </section>
  );
}

function PreviewContent({ previewRef }: { previewRef: React.MutableRefObject<HTMLDivElement | null> }) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const frameCleanupRef = useRef<(() => void) | null>(null);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const theme = useSettingsStore((state) => state.theme);
  const htmlPreviewMode = useSettingsStore((state) => state.htmlPreviewMode);
  const [html, setHtml] = useState('');
  const [blockLayouts, setBlockLayouts] = useState<BlockLayout[]>([]);
  const fileType = getFileTypeInfo(activeFile?.name, activeFile?.path);
  const usesBrowserFrame = fileType.previewKind === 'html' && htmlPreviewMode === 'browser';
  const usesStructuredPreview = fileType.previewKind === 'structured-data' || fileType.previewKind === 'tabular-data';

  useEffect(() => {
    let alive = true;
    const filePath = activeFile?.path;

    if (!filePath || filePath.startsWith('~') || filePath.startsWith('browser://') || fileType.previewKind !== 'markdown') {
      setBlockLayouts([]);
      return () => {
        alive = false;
      };
    }

    void Backend.loadBlockLayouts(filePath)
      .then((layouts) => {
        if (alive) setBlockLayouts(layouts);
      })
      .catch((error) => {
        console.error('failed to load block layouts', error);
        if (alive) setBlockLayouts([]);
      });

    return () => {
      alive = false;
    };
  }, [activeFile?.path, fileType.previewKind]);

  const saveBlockLayout = useCallback((layoutOrLayouts: BlockLayout | BlockLayout[]) => {
    const layouts = Array.isArray(layoutOrLayouts) ? layoutOrLayouts : [layoutOrLayouts];
    setBlockLayouts((current) => layouts.reduce(upsertBlockLayout, current));
    void Promise.all(layouts.map((layout) => Backend.saveBlockLayout(layout))).catch((error) => {
      console.error('failed to save block layouts', error);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const content = activeFile?.content ?? '';

    if (usesStructuredPreview) {
      setHtml('');
      return () => {
        alive = false;
      };
    }

    if (fileType.previewKind === 'html') {
      setHtml(
        htmlPreviewMode === 'browser'
          ? renderBrowserHtmlDocument(content, activeFile?.path)
          : renderSafeHtmlDocument(content, activeFile?.path),
      );
      return () => {
        alive = false;
      };
    }

    if (fileType.previewKind !== 'markdown') {
      setHtml(`<pre class="plain-text-preview">${escapeHtml(content)}</pre>`);
      return () => {
        alive = false;
      };
    }

    const mode = theme === 'dark' || theme === 'nord' ? 'dark' : 'light';
    void renderMarkdown(content, mode, activeFile?.path).then((nextHtml) => {
      if (alive) setHtml(nextHtml);
    });
    return () => {
      alive = false;
    };
  }, [activeFile?.content, activeFile?.name, activeFile?.path, fileType.previewKind, htmlPreviewMode, theme, usesStructuredPreview]);

  useLayoutEffect(() => {
    notifyPreviewRendered(localRef.current);
  }, [activeFile?.content, fileType.previewKind, html]);

  useEffect(
    () => () => {
      frameCleanupRef.current?.();
      frameCleanupRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const root = localRef.current;
    if (!root) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href') ?? '';
      if (!rawHref || rawHref.startsWith('#')) return;
      if (!isExternalUrl(anchor.href)) return;

      event.preventDefault();
      void openExternalUrl(anchor.href);
    };

    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [html]);

  useEffect(() => {
    const root = localRef.current;
    if (!root) return;

    const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
    if (images.length === 0) return;

    const onLoad = (event: Event) => {
      if (event.currentTarget instanceof HTMLImageElement) {
        event.currentTarget.classList.remove('image-load-failed');
      }
      notifyPreviewRendered(root);
    };
    const onError = (event: Event) => {
      if (event.currentTarget instanceof HTMLImageElement) {
        event.currentTarget.classList.add('image-load-failed');
      }
      notifyPreviewRendered(root);
    };

    images.forEach((image) => {
      image.addEventListener('load', onLoad);
      image.addEventListener('error', onError);
    });

    return () => {
      images.forEach((image) => {
        image.removeEventListener('load', onLoad);
        image.removeEventListener('error', onError);
      });
    };
  }, [html]);

  useEffect(() => {
    const root = localRef.current;
    if (!root) return;

    let alive = true;

    void import('mermaid').then(({ default: mermaid }) => {
      if (!alive) return;
      const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block[data-source]'));
      if (blocks.length === 0) return;

      mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'default' ? 'default' : 'dark',
        securityLevel: 'strict',
      });

      void Promise.all(
        blocks.map(async (block, index) => {
          try {
            const source = decodeURIComponent(block.dataset.source || '');
            const id = `mermaid-${Date.now()}-${index}`;
            const { svg } = await mermaid.render(id, source);
            if (alive) {
              block.innerHTML = svg;
              block.dataset.rendered = 'true';
            }
          } catch (error) {
            console.error('failed to render mermaid block', error);
            if (alive) block.dataset.rendered = 'false';
          }
        }),
      ).finally(() => {
        if (!alive) return;
        const filePath = activeFile?.path;
        if (filePath && fileType.previewKind === 'markdown') {
          enhancePreviewLayoutBlocks(root, filePath, blockLayouts, saveBlockLayout);
        }
        notifyPreviewRendered(root);
      });
    });

    return () => {
      alive = false;
    };
  }, [activeFile?.path, blockLayouts, fileType.previewKind, html, saveBlockLayout, theme]);

  useEffect(() => {
    const root = localRef.current;
    const filePath = activeFile?.path;
    if (!root || !filePath || fileType.previewKind !== 'markdown') return;

    enhancePreviewLayoutBlocks(root, filePath, blockLayouts, saveBlockLayout);
  }, [activeFile?.path, blockLayouts, fileType.previewKind, html, saveBlockLayout]);

  const className = usesBrowserFrame ? 'preview-content html-preview-browser' : 'preview-content';
  const setPreviewElement = (element: HTMLDivElement | null) => {
    localRef.current = element;
    previewRef.current = element;
  };

  if (usesBrowserFrame) {
    return (
      <div className={className} ref={setPreviewElement}>
        <iframe
          ref={frameRef}
          className="html-preview-frame"
          sandbox="allow-same-origin"
          srcDoc={html}
          title="HTML 미리보기"
          onLoad={() => bindHtmlPreviewFrame(frameRef.current, localRef.current, frameCleanupRef)}
        />
      </div>
    );
  }

  if (fileType.previewKind === 'structured-data') {
    return (
      <div className={className} ref={setPreviewElement}>
        <StructuredDataPreview content={activeFile?.content ?? ''} fileType={fileType} fileKey={activeFile?.id} />
      </div>
    );
  }

  if (fileType.previewKind === 'tabular-data') {
    return (
      <div className={className} ref={setPreviewElement}>
        <TabularDataPreview content={activeFile?.content ?? ''} fileType={fileType} />
      </div>
    );
  }

  return (
    <div
      className={className}
      ref={setPreviewElement}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function notifyPreviewRendered(root: HTMLDivElement | null): void {
  root?.dispatchEvent(new CustomEvent('saekim-preview-rendered', { bubbles: false }));
}

function bindHtmlPreviewFrame(
  frame: HTMLIFrameElement | null,
  root: HTMLDivElement | null,
  cleanupRef: MutableRefObject<(() => void) | null>,
): void {
  cleanupRef.current?.();
  cleanupRef.current = null;

  const doc = frame?.contentDocument;
  if (!frame || !doc) return;

  const syncHeight = () => {
    const bodyHeight = doc.body?.scrollHeight ?? 0;
    const documentHeight = doc.documentElement?.scrollHeight ?? 0;
    frame.style.height = `${Math.max(bodyHeight, documentHeight, root?.clientHeight ?? 0)}px`;
    notifyPreviewRendered(root);
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;

    const rawHref = anchor.getAttribute('href') ?? '';
    if (!rawHref || rawHref.startsWith('#')) return;

    event.preventDefault();
    void openExternalUrl(anchor.href);
  };

  const observer = new ResizeObserver(syncHeight);
  observer.observe(doc.documentElement);
  if (doc.body) observer.observe(doc.body);
  doc.addEventListener('click', onClick);
  requestAnimationFrame(syncHeight);

  cleanupRef.current = () => {
    observer.disconnect();
    doc.removeEventListener('click', onClick);
  };
}

type LayoutTarget = {
  element: HTMLElement;
  blockKind: BlockKind;
  blockKey: string;
  occurrenceIndex: number;
};

type LayoutChangeHandler = (layout: BlockLayout | BlockLayout[]) => void;

const layoutWidths = [100, 75, 50, 33];
const layoutAligns: LayoutAlign[] = ['left', 'center', 'right'];

function enhancePreviewLayoutBlocks(
  root: HTMLElement,
  filePath: string,
  layouts: BlockLayout[],
  onChange: LayoutChangeHandler,
): void {
  if (filePath.startsWith('~') || filePath.startsWith('browser://')) return;

  unwrapLayoutGroups(root);

  const layoutByKey = new Map(layouts.map((layout) => [layoutIdentity(layout), layout]));
  root.querySelectorAll<HTMLElement>('.preview-layout-block').forEach((wrapper) => {
    const blockKind = blockKindFromDataset(wrapper.dataset.blockKind);
    const blockKey = wrapper.dataset.blockKey;
    const occurrenceIndex = Number.parseInt(wrapper.dataset.occurrenceIndex ?? '', 10);
    if (!blockKind || !blockKey || !Number.isFinite(occurrenceIndex)) return;

    const identity = { blockKind, blockKey, occurrenceIndex };
    const layout =
      layoutByKey.get(layoutIdentity(identity)) ??
      defaultBlockLayout(filePath, blockKind, blockKey, occurrenceIndex);
    ensureLayoutSurface(wrapper);
    applyBlockLayout(wrapper, layout);
    renderLayoutControls(wrapper, layout, root, filePath, layoutByKey, onChange);
  });

  const targets = collectLayoutTargets(root);

  targets.forEach((target) => {
    const wrapper = ensureLayoutWrapper(target);
    const layout =
      layoutByKey.get(layoutIdentity(target)) ??
      defaultBlockLayout(filePath, target.blockKind, target.blockKey, target.occurrenceIndex);

    applyBlockLayout(wrapper, layout);
    renderLayoutControls(wrapper, layout, root, filePath, layoutByKey, onChange);
  });

  arrangeLayoutGroups(root);
}

function collectLayoutTargets(root: HTMLElement): LayoutTarget[] {
  const targets: LayoutTarget[] = [];
  const imageCounts = new Map<string, number>();
  const genericCounts = new Map<string, number>();

  root.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    if (image.closest('.preview-layout-block, .pending-image-block, .failed-image-block')) return;

    const blockKey = image.getAttribute('data-original-src') || image.getAttribute('src') || image.alt || 'image';
    const occurrenceIndex = nextOccurrence(imageCounts, blockKey);
    targets.push({ element: image, blockKind: 'image', blockKey, occurrenceIndex });
  });

  root
    .querySelectorAll<HTMLElement>('table, ul, ol, blockquote, pre, .mermaid-block, .math-block')
    .forEach((element) => {
      if (element.closest('.preview-layout-block')) return;
      if ((element.tagName === 'UL' || element.tagName === 'OL') && element.closest('li')) return;
      if (element.classList.contains('mermaid-block') && !element.querySelector('svg')) return;

      const blockKind = blockKindForElement(element);
      const blockKey = stableBlockKey(element, blockKind);
      const occurrenceIndex = nextOccurrence(genericCounts, `${blockKind}:${blockKey}`);
      targets.push({ element, blockKind, blockKey, occurrenceIndex });
    });

  return targets;
}

function ensureLayoutWrapper(target: LayoutTarget): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `preview-layout-block preview-${target.blockKind}-layout`;
  wrapper.dataset.blockKind = target.blockKind;
  wrapper.dataset.blockKey = target.blockKey;
  wrapper.dataset.occurrenceIndex = String(target.occurrenceIndex);

  const parent = target.element.parentElement;
  const sourceElement = target.blockKind === 'image' && parent?.tagName === 'P' ? parent : target.element;
  copySourceLineDataset(sourceElement, wrapper);

  if (target.blockKind === 'image' && parent?.tagName === 'P' && isSingleImageParagraph(parent)) {
    parent.replaceWith(wrapper);
  } else {
    target.element.replaceWith(wrapper);
  }

  const surface = document.createElement('div');
  surface.className = 'preview-layout-surface';
  surface.append(target.element);
  wrapper.append(surface);
  return wrapper;
}

function ensureLayoutSurface(wrapper: HTMLElement): HTMLElement {
  const existing = wrapper.querySelector<HTMLElement>(':scope > .preview-layout-surface');
  if (existing) return existing;

  const surface = document.createElement('div');
  surface.className = 'preview-layout-surface';
  Array.from(wrapper.childNodes).forEach((node) => {
    if (node instanceof HTMLElement && node.classList.contains('preview-layout-tools')) return;
    surface.append(node);
  });
  wrapper.prepend(surface);
  return surface;
}

function renderLayoutControls(
  wrapper: HTMLElement,
  layout: BlockLayout,
  root: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
  onChange: LayoutChangeHandler,
): void {
  wrapper.querySelector('.preview-layout-tools')?.remove();

  const tools = document.createElement('div');
  tools.className = 'preview-layout-tools';
  tools.setAttribute('aria-label', '블록 레이아웃');
  bindLayoutSelection(root, wrapper);

  layoutWidths.forEach((width) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${width}%`;
    button.title = `너비 ${width}%`;
    button.className = layout.widthValue === width && layout.widthUnit === '%' ? 'active' : '';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onChange(clearLayoutGroup({ ...layout, widthValue: width, widthUnit: '%' }));
    });
    tools.append(button);
  });

  if (isGroupedLayout(layout)) {
    renderGroupPositionButtons(tools, layout, onChange);
  } else {
    layoutAligns.forEach((align) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = align === 'left' ? 'L' : align === 'center' ? 'C' : 'R';
      button.title = align === 'left' ? '왼쪽 정렬' : align === 'center' ? '가운데 정렬' : '오른쪽 정렬';
      button.className = layout.align === align ? 'active' : '';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onChange({ ...layout, align });
      });
      tools.append(button);
    });
  }

  const twoColumnCandidates = contiguousLayoutWrappers(root, wrapper, 2);
  const threeColumnCandidates = contiguousLayoutWrappers(root, wrapper, 3);

  [2, 3].forEach((columns) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${columns}열`;
    button.title = `${columns}열로 묶기`;
    button.disabled = isGroupedLayout(layout) || (columns === 2 ? twoColumnCandidates : threeColumnCandidates).length !== columns;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const candidates = columns === 2 ? twoColumnCandidates : threeColumnCandidates;
      if (candidates.length !== columns) return;

      const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      onChange(
        candidates.map((item, index) =>
          withColumnGroup(layoutForWrapper(item, filePath, layoutByKey), groupId, columns, index),
        ),
      );
    });
    tools.append(button);
  });

  const ungroupButton = document.createElement('button');
  ungroupButton.type = 'button';
  ungroupButton.textContent = '풀기';
  ungroupButton.title = '묶음 풀기';
  ungroupButton.disabled = !isGroupedLayout(layout);
  ungroupButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const groupId = getLayoutGroupId(layout);
    const groupedLayouts = getLayoutWrappers(root)
      .filter((item) => item.dataset.groupId === groupId)
      .map((item) => layoutForWrapper(item, filePath, layoutByKey))
      .map((item) => clearLayoutGroup({ ...item, widthValue: 100, widthUnit: '%' }));
    onChange(groupedLayouts.length > 0 ? groupedLayouts : clearLayoutGroup(layout));
  });
  tools.append(ungroupButton);

  wrapper.append(tools);
}

function bindLayoutSelection(root: HTMLElement, wrapper: HTMLElement): void {
  if (!root.dataset.layoutSelectionBound) {
    root.dataset.layoutSelectionBound = 'true';
    root.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.preview-layout-block')) return;
      clearSelectedLayoutBlocks(root);
    });
  }

  if (wrapper.dataset.layoutSelectionBound) return;
  wrapper.dataset.layoutSelectionBound = 'true';
  wrapper.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('.preview-layout-tools')) return;
    clearSelectedLayoutBlocks(root);
    wrapper.dataset.selected = 'true';
  });
}

function clearSelectedLayoutBlocks(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.preview-layout-block[data-selected="true"]').forEach((item) => {
    delete item.dataset.selected;
  });
}

function renderGroupPositionButtons(
  tools: HTMLElement,
  layout: BlockLayout,
  onChange: LayoutChangeHandler,
): void {
  const columns = getLayoutGroupColumns(layout);
  const labels = columns === 2 ? ['L/C', 'R'] : ['L', 'C', 'R'];
  const currentIndex = getLayoutGroupIndex(layout);

  labels.forEach((label, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = `${columns}열 위치: ${label}`;
    button.className = currentIndex === index ? 'active' : '';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onChange(withGroupIndex(layout, index));
    });
    tools.append(button);
  });
}

function applyBlockLayout(wrapper: HTMLElement, layout: BlockLayout): void {
  const width =
    layout.widthUnit === 'auto' || layout.widthValue === null
      ? 'auto'
      : `${Math.max(10, Math.min(100, layout.widthValue))}${layout.widthUnit}`;

  wrapper.style.setProperty('--block-layout-width', width);
  wrapper.dataset.align = layout.align;
  wrapper.dataset.widthUnit = layout.widthUnit;
  wrapper.dataset.widthValue = layout.widthValue === null ? 'auto' : String(layout.widthValue);
  wrapper.dataset.flow = getLayoutGroupColumns(layout) > 1 ? 'columns' : 'block';
  wrapper.dataset.groupColumns = String(getLayoutGroupColumns(layout));
  wrapper.dataset.groupIndex = String(getLayoutGroupIndex(layout));
  wrapper.style.setProperty('--preview-layout-column', String(getLayoutGroupIndex(layout) + 1));
  const groupId = getLayoutGroupId(layout);
  if (groupId) {
    wrapper.dataset.groupId = groupId;
  } else {
    delete wrapper.dataset.groupId;
  }
}

function defaultBlockLayout(
  filePath: string,
  blockKind: BlockKind,
  blockKey: string,
  occurrenceIndex: number,
): BlockLayout {
  return {
    filePath,
    blockKind,
    blockKey,
    occurrenceIndex,
    widthValue: 100,
    widthUnit: '%',
    heightValue: null,
    heightUnit: 'auto',
    align: blockKind === 'list' || blockKind === 'blockquote' ? 'left' : 'center',
    layoutJson: null,
  };
}

function upsertBlockLayout(layouts: BlockLayout[], next: BlockLayout): BlockLayout[] {
  return [
    ...layouts.filter((layout) => layoutIdentity(layout) !== layoutIdentity(next)),
    next,
  ];
}

function layoutForWrapper(
  wrapper: HTMLElement,
  filePath: string,
  layoutByKey: Map<string, BlockLayout>,
): BlockLayout {
  const blockKind = blockKindFromDataset(wrapper.dataset.blockKind) ?? 'image';
  const blockKey = wrapper.dataset.blockKey ?? 'block';
  const occurrenceIndex = Number.parseInt(wrapper.dataset.occurrenceIndex ?? '0', 10);
  const identity = { blockKind, blockKey, occurrenceIndex };
  return (
    layoutByKey.get(layoutIdentity(identity)) ??
    defaultBlockLayout(filePath, blockKind, blockKey, Number.isFinite(occurrenceIndex) ? occurrenceIndex : 0)
  );
}

function getLayoutWrappers(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.preview-layout-block'));
}

function contiguousLayoutWrappers(root: HTMLElement, wrapper: HTMLElement, columns: number): HTMLElement[] {
  const wrappers = getLayoutWrappers(root);
  const index = wrappers.indexOf(wrapper);
  if (index < 0) return [];

  const forward = wrappers.slice(index, index + columns);
  if (forward.length === columns && wrappersAreContiguous(forward)) return forward;

  for (let start = Math.max(0, index - columns + 1); start <= index; start += 1) {
    const slice = wrappers.slice(start, start + columns);
    if (slice.length === columns && slice.includes(wrapper) && wrappersAreContiguous(slice)) {
      return slice;
    }
  }

  return [];
}

function wrappersAreContiguous(wrappers: HTMLElement[]): boolean {
  for (let index = 1; index < wrappers.length; index += 1) {
    if (!sourceLinesAreContiguous(wrappers[index - 1], wrappers[index])) return false;
  }
  return true;
}

function sourceLinesAreContiguous(previous: HTMLElement, next: HTMLElement): boolean {
  const previousEndLine = sourceEndLine(previous);
  const nextStartLine = sourceStartLine(next);
  return previousEndLine !== null && nextStartLine !== null && nextStartLine <= previousEndLine + 1;
}

function withColumnGroup(layout: BlockLayout, groupId: string, columns: number, index: number): BlockLayout {
  const width = columns === 2 ? 50 : 33.3333;
  return {
    ...layout,
    widthValue: width,
    widthUnit: '%',
    align: 'left',
    layoutJson: {
      ...(layout.layoutJson ?? {}),
      groupId,
      groupColumns: columns,
      groupIndex: index,
    },
  };
}

function withGroupIndex(layout: BlockLayout, index: number): BlockLayout {
  return {
    ...layout,
    layoutJson: {
      ...(layout.layoutJson ?? {}),
      groupIndex: index,
    },
  };
}

function clearLayoutGroup(layout: BlockLayout): BlockLayout {
  const rest = { ...(layout.layoutJson ?? {}) };
  delete rest.groupId;
  delete rest.groupColumns;
  delete rest.groupIndex;
  return {
    ...layout,
    layoutJson: Object.keys(rest).length > 0 ? rest : null,
  };
}

function isGroupedLayout(layout: BlockLayout): boolean {
  return getLayoutGroupColumns(layout) > 1 && Boolean(getLayoutGroupId(layout));
}

function getLayoutGroupId(layout: BlockLayout): string | null {
  const value = layout.layoutJson?.groupId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getLayoutGroupColumns(layout: BlockLayout): number {
  const value = layout.layoutJson?.groupColumns;
  return typeof value === 'number' && value > 1 ? value : 1;
}

function getLayoutGroupIndex(layout: BlockLayout): number {
  const value = layout.layoutJson?.groupIndex;
  return typeof value === 'number' && value >= 0 ? value : 0;
}

function unwrapLayoutGroups(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.preview-layout-group').forEach((group) => {
    const parent = group.parentElement;
    if (!parent) return;
    Array.from(group.children).forEach((child) => {
      parent.insertBefore(child, group);
    });
    group.remove();
  });
}

function arrangeLayoutGroups(root: HTMLElement): void {
  const wrappers = getLayoutWrappers(root);
  let index = 0;

  while (index < wrappers.length) {
    const wrapper = wrappers[index];
    const groupId = wrapper.dataset.groupId;
    const columns = Number.parseInt(wrapper.dataset.groupColumns ?? '1', 10);
    if (!groupId || columns <= 1) {
      index += 1;
      continue;
    }

    const groupWrappers = wrappers
      .filter((item) => item.dataset.groupId === groupId)
      .sort((a, b) => Number.parseInt(a.dataset.groupIndex ?? '0', 10) - Number.parseInt(b.dataset.groupIndex ?? '0', 10));
    if (groupWrappers.length <= 1) {
      index += 1;
      continue;
    }

    const group = document.createElement('div');
    group.className = 'preview-layout-group';
    group.dataset.columns = String(columns);
    group.style.setProperty('--preview-layout-columns', String(columns));
    wrapper.before(group);
    groupWrappers.forEach((item) => group.append(item));
    index += groupWrappers.length;
  }
}

function copySourceLineDataset(from: HTMLElement, to: HTMLElement): void {
  const startLine = from.getAttribute('data-source-line');
  const endLine = from.getAttribute('data-source-end-line') ?? startLine;
  if (startLine) to.dataset.sourceLine = startLine;
  if (endLine) to.dataset.sourceEndLine = endLine;
}

function sourceStartLine(element: HTMLElement): number | null {
  const value = element.dataset.sourceLine ?? element.getAttribute('data-source-line');
  const line = Number.parseInt(value ?? '', 10);
  return Number.isFinite(line) ? line : null;
}

function sourceEndLine(element: HTMLElement): number | null {
  const value = element.dataset.sourceEndLine ?? element.getAttribute('data-source-end-line') ?? element.dataset.sourceLine;
  const line = Number.parseInt(value ?? '', 10);
  return Number.isFinite(line) ? line : null;
}

function layoutIdentity(layout: Pick<BlockLayout, 'blockKind' | 'blockKey' | 'occurrenceIndex'>): string {
  return `${layout.blockKind}:${layout.blockKey}:${layout.occurrenceIndex}`;
}

function nextOccurrence(counts: Map<string, number>, key: string): number {
  const next = counts.get(key) ?? 0;
  counts.set(key, next + 1);
  return next;
}

function blockKindForElement(element: HTMLElement): BlockKind {
  if (element.classList.contains('mermaid-block')) return 'mermaid';
  if (element.classList.contains('math-block')) return 'katex';
  if (element.tagName === 'TABLE') return 'table';
  if (element.tagName === 'BLOCKQUOTE') return 'blockquote';
  if (element.tagName === 'PRE') return 'code';
  return 'list';
}

function blockKindFromDataset(value?: string): BlockKind | null {
  if (
    value === 'image' ||
    value === 'table' ||
    value === 'list' ||
    value === 'blockquote' ||
    value === 'code' ||
    value === 'mermaid' ||
    value === 'katex'
  ) {
    return value;
  }
  return null;
}

function stableBlockKey(element: HTMLElement, kind: BlockKind): string {
  const sourceLine = element.getAttribute('data-source-line') ?? '0';
  const sourceEndLine = element.getAttribute('data-source-end-line') ?? sourceLine;
  const text = element.dataset.source ?? element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return `${kind}:${sourceLine}-${sourceEndLine}:${stableHash(text)}`;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isSingleImageParagraph(paragraph: HTMLElement): boolean {
  const children = Array.from(paragraph.childNodes);
  const imageCount = children.filter((node) => node instanceof HTMLImageElement).length;
  if (imageCount !== 1) return false;

  return children.every((node) => {
    if (node.nodeType === Node.TEXT_NODE) return !node.textContent?.trim();
    if (node instanceof HTMLBRElement) return true;
    return node instanceof HTMLImageElement;
  });
}
