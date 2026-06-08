import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { PreviewRenderContext, PreviewResult } from '../../app/feature';
import { enabledFeatures } from '../../app/featureRegistry';
import { getFileTypeInfo } from '../../core/document/fileType';
import { selectPreviewEnhancements, selectPreviewRenderer } from '../../core/preview/registry';
import {
  canUseBlockLayouts,
  enhancePreviewLayoutBlocks,
  readBlockLayouts,
  writeBlockLayouts,
} from '../../features/block-layout';
import { isExternalUrl, openExternalUrl } from '../../lib/tauri/opener';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { BlockLayout } from '../../types/metadata';
import { Icon } from '../primitives/Icon';
import { EmptyState } from '../ui/feedback/EmptyState';
import { ToolbarButton } from '../ui/toolbar/Toolbar';

type BlockLayoutChange = BlockLayout | BlockLayout[];

export function PreviewPane({ previewRef }: { previewRef: MutableRefObject<HTMLDivElement | null> }) {
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const theme = useSettingsStore((state) => state.theme);
  const htmlPreviewMode = useSettingsStore((state) => state.htmlPreviewMode);
  const setHtmlPreviewMode = useSettingsStore((state) => state.setHtmlPreviewMode);
  const fileType = getFileTypeInfo(activeFile?.name, activeFile?.path, enabledFeatures);
  const previewContext = activeFile
    ? ({ file: activeFile, fileType, theme, htmlPreviewMode, setHtmlPreviewMode } satisfies PreviewRenderContext)
    : null;
  const renderer = previewContext ? selectPreviewRenderer(enabledFeatures, previewContext) : null;

  return (
    <section className="preview-pane" data-disabled={!activeFile}>
      <div className="preview-head">
        <span className="label">미리보기</span>
        {previewContext ? renderer?.head?.(previewContext) : null}
        <ToolbarButton
          className={`preview-action ${syncScroll ? 'active' : ''}`}
          disabled={!activeFile}
          title={syncScroll ? '스크롤 동기화 풀기' : '스크롤 동기화'}
          onClick={toggleSyncScroll}
        >
          <Icon name={syncScroll ? 'link' : 'unlink'} />
        </ToolbarButton>
      </div>
      <PreviewContent previewRef={previewRef} />
    </section>
  );
}

function PreviewContent({ previewRef }: { previewRef: MutableRefObject<HTMLDivElement | null> }) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const frameCleanupRef = useRef<(() => void) | null>(null);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const theme = useSettingsStore((state) => state.theme);
  const htmlPreviewMode = useSettingsStore((state) => state.htmlPreviewMode);
  const setHtmlPreviewMode = useSettingsStore((state) => state.setHtmlPreviewMode);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [blockLayouts, setBlockLayouts] = useState<BlockLayout[]>([]);
  const fileType = getFileTypeInfo(activeFile?.name, activeFile?.path, enabledFeatures);
  const previewContext = useMemo<PreviewRenderContext | null>(
    () =>
      activeFile
        ? { file: activeFile, fileType, theme, htmlPreviewMode, setHtmlPreviewMode }
        : null,
    [activeFile, fileType.label, fileType.language, fileType.previewKind, htmlPreviewMode, setHtmlPreviewMode, theme],
  );
  const renderer = previewContext ? selectPreviewRenderer(enabledFeatures, previewContext) : null;
  const enhancements = previewContext ? selectPreviewEnhancements(enabledFeatures, previewContext) : [];
  const enhancementIds = enhancements.map((contribution) => contribution.id).join('|');
  const usesBrowserFrame = previewResult?.kind === 'html' && previewResult.renderMode === 'browser-frame';

  useEffect(() => {
    let alive = true;
    const filePath = activeFile?.path;

    if (!canUseBlockLayouts(filePath, renderer?.supportsBlockLayouts)) {
      setBlockLayouts([]);
      return () => {
        alive = false;
      };
    }

    void readBlockLayouts(filePath)
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
  }, [activeFile?.path, renderer?.id, renderer?.supportsBlockLayouts]);

  const saveBlockLayout = useCallback((layoutOrLayouts: BlockLayoutChange) => {
    const layouts = Array.isArray(layoutOrLayouts) ? layoutOrLayouts : [layoutOrLayouts];
    setBlockLayouts((current) => layouts.reduce(upsertBlockLayout, current));
    void writeBlockLayouts(layouts).catch((error) => {
      console.error('failed to save block layouts', error);
    });
  }, []);

  useEffect(() => {
    if (!previewContext || !renderer?.render) {
      setPreviewResult(null);
      return;
    }

    const controller = new AbortController();
    const renderContext = { ...previewContext, signal: controller.signal };
    void Promise.resolve(renderer.render(renderContext))
      .then((result) => {
        if (!controller.signal.aborted) setPreviewResult(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error(`failed to render preview contribution "${renderer.id}"`, error);
          setPreviewResult({
            kind: 'html',
            html: '<div class="preview-error-panel compact"><strong>Preview failed</strong><pre>미리보기를 렌더링하지 못했습니다.</pre></div>',
          });
        }
      });

    return () => {
      controller.abort();
    };
  }, [
    activeFile?.content,
    activeFile?.id,
    activeFile?.name,
    activeFile?.path,
    fileType.language,
    fileType.previewKind,
    htmlPreviewMode,
    previewContext,
    renderer,
    theme,
  ]);

  const previewRenderKey =
    previewResult?.kind === 'react'
      ? `${renderer?.id ?? 'react'}:${previewResult.renderKey ?? activeFile?.id ?? ''}:${activeFile?.content ?? ''}`
      : previewResult?.html ?? '';

  useLayoutEffect(() => {
    notifyPreviewRendered(localRef.current);
  }, [activeFile?.path, renderer?.id, previewRenderKey]);

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
  }, [previewRenderKey]);

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
  }, [previewRenderKey]);

  useEffect(() => {
    const root = localRef.current;
    if (!root || !previewContext || !renderer) return;

    const controller = new AbortController();
    const renderContext = { ...previewContext, signal: controller.signal };

    void (async () => {
      try {
        await renderer.afterRender?.(root, renderContext, controller.signal);
        for (const enhancement of enhancements) {
          if (controller.signal.aborted) return;
          await enhancement.afterRender?.(root, renderContext, controller.signal);
        }
        if (!controller.signal.aborted && canUseBlockLayouts(activeFile?.path, renderer.supportsBlockLayouts)) {
          enhancePreviewLayoutBlocks(root, activeFile.path, blockLayouts, saveBlockLayout);
        }
        if (!controller.signal.aborted) notifyPreviewRendered(root);
      } catch (error) {
        if (!controller.signal.aborted) console.error('failed to run preview lifecycle', error);
      }
    })();

    return () => {
      controller.abort();
      renderer.cleanup?.(root);
      enhancements.forEach((enhancement) => enhancement.cleanup?.(root));
    };
  }, [
    activeFile?.path,
    blockLayouts,
    enhancementIds,
    previewContext,
    previewRenderKey,
    renderer,
    saveBlockLayout,
  ]);

  useEffect(() => {
    const root = localRef.current;
    const filePath = activeFile?.path;
    if (!root || !canUseBlockLayouts(filePath, renderer?.supportsBlockLayouts)) return;

    enhancePreviewLayoutBlocks(root, filePath, blockLayouts, saveBlockLayout);
  }, [activeFile?.path, blockLayouts, previewRenderKey, renderer?.id, renderer?.supportsBlockLayouts, saveBlockLayout]);

  const className = usesBrowserFrame ? 'preview-content html-preview-browser' : 'preview-content';
  const setPreviewElement = (element: HTMLDivElement | null) => {
    localRef.current = element;
    previewRef.current = element;
  };

  if (!activeFile) {
    return (
      <div className={`${className} empty-document-content`} ref={setPreviewElement}>
        <EmptyState
          className="empty-document-state"
          title="열린 문서가 없습니다"
          description="워크스페이스에서 파일을 선택하거나 파일을 열어주세요."
        />
      </div>
    );
  }

  if (!previewResult) {
    return <div className={className} ref={setPreviewElement} />;
  }

  if (usesBrowserFrame && previewResult.kind === 'html') {
    return (
      <div className={className} ref={setPreviewElement}>
        <iframe
          ref={frameRef}
          className="html-preview-frame"
          sandbox="allow-same-origin"
          srcDoc={previewResult.html}
          title="HTML 미리보기"
          onLoad={() => bindHtmlPreviewFrame(frameRef.current, localRef.current, frameCleanupRef)}
        />
      </div>
    );
  }

  if (previewResult.kind === 'react') {
    return (
      <div className={className} ref={setPreviewElement}>
        {previewResult.node}
      </div>
    );
  }

  return (
    <div
      className={className}
      ref={setPreviewElement}
      dangerouslySetInnerHTML={{ __html: previewResult.html }}
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

function upsertBlockLayout(layouts: BlockLayout[], next: BlockLayout): BlockLayout[] {
  return [
    ...layouts.filter((layout) => layoutIdentity(layout) !== layoutIdentity(next)),
    next,
  ];
}

function layoutIdentity(layout: Pick<BlockLayout, 'blockKind' | 'blockKey' | 'occurrenceIndex'>): string {
  return `${layout.blockKind}:${layout.blockKey}:${layout.occurrenceIndex}`;
}
