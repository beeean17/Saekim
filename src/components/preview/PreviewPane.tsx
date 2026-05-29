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

  const saveBlockLayout = useCallback((layout: BlockLayout) => {
    setBlockLayouts((current) => upsertBlockLayout(current, layout));
    void Backend.saveBlockLayout(layout).catch((error) => {
      console.error('failed to save block layout', error);
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

    const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block[data-source]'));
    if (blocks.length === 0) return;
    let alive = true;

    void import('mermaid').then(({ default: mermaid }) => {
      if (!alive) return;
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'default' ? 'default' : 'dark',
        securityLevel: 'strict',
      });

      void Promise.all(
        blocks.map(async (block, index) => {
          const source = decodeURIComponent(block.dataset.source || '');
          const id = `mermaid-${Date.now()}-${index}`;
          const { svg } = await mermaid.render(id, source);
          if (alive) block.innerHTML = svg;
        }),
      ).finally(() => {
        if (alive) notifyPreviewRendered(root);
      });
    });

    return () => {
      alive = false;
    };
  }, [html, theme]);

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

const layoutWidths = [100, 75, 50, 33];
const layoutAligns: LayoutAlign[] = ['left', 'center', 'right'];

function enhancePreviewLayoutBlocks(
  root: HTMLElement,
  filePath: string,
  layouts: BlockLayout[],
  onChange: (layout: BlockLayout) => void,
): void {
  if (filePath.startsWith('~') || filePath.startsWith('browser://')) return;

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
    applyBlockLayout(wrapper, layout);
    renderLayoutControls(wrapper, layout, onChange);
  });

  const targets = collectLayoutTargets(root);

  targets.forEach((target) => {
    const wrapper = ensureLayoutWrapper(target);
    const layout =
      layoutByKey.get(layoutIdentity(target)) ??
      defaultBlockLayout(filePath, target.blockKind, target.blockKey, target.occurrenceIndex);

    applyBlockLayout(wrapper, layout);
    renderLayoutControls(wrapper, layout, onChange);
  });
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
    .querySelectorAll<HTMLElement>('table, ul, ol, blockquote, .mermaid-block, .math-block')
    .forEach((element) => {
      if (element.closest('.preview-layout-block')) return;
      if ((element.tagName === 'UL' || element.tagName === 'OL') && element.closest('li')) return;

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
  if (target.blockKind === 'image' && parent?.tagName === 'P' && isSingleImageParagraph(parent)) {
    parent.replaceWith(wrapper);
  } else {
    target.element.replaceWith(wrapper);
  }

  wrapper.append(target.element);
  return wrapper;
}

function renderLayoutControls(
  wrapper: HTMLElement,
  layout: BlockLayout,
  onChange: (layout: BlockLayout) => void,
): void {
  wrapper.querySelector('.preview-layout-tools')?.remove();

  const tools = document.createElement('div');
  tools.className = 'preview-layout-tools';
  tools.setAttribute('aria-label', '블록 레이아웃');

  layoutWidths.forEach((width) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = width === 100 ? '1열' : width === 50 ? '2열' : width === 33 ? '3열' : `${width}%`;
    button.title = `너비 ${width}%`;
    button.className = layout.widthValue === width && layout.widthUnit === '%' ? 'active' : '';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onChange({ ...layout, widthValue: width, widthUnit: '%' });
    });
    tools.append(button);
  });

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

  wrapper.prepend(tools);
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
  return 'list';
}

function blockKindFromDataset(value?: string): BlockKind | null {
  if (
    value === 'image' ||
    value === 'table' ||
    value === 'list' ||
    value === 'blockquote' ||
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
