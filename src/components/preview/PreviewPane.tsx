import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { PreviewContribution, PreviewRenderContext, PreviewResult } from '../../app/feature';
import { enabledFeatures } from '../../app/featureRegistry';
import { getFileTypeInfo } from '../../core/document/fileType';
import { selectPreviewEnhancements, selectPreviewRenderer } from '../../core/preview/registry';
import { reusePreviewLayoutBlocks } from '../../features/block-layout/preview';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { Icon } from '../primitives/Icon';
import { EmptyState } from '../ui/feedback/EmptyState';
import { ToolbarButton } from '../ui/toolbar/Toolbar';
import { bindHtmlPreviewFrame, notifyPreviewRendered, previewDomEnhancements } from './domLifecycle';

const CONTENT_RENDER_DEBOUNCE_MS = 180;

interface PreviewPaneProps {
  readonly previewRef: MutableRefObject<HTMLDivElement | null>;
  readonly onPreviewElementChange: (element: HTMLDivElement | null) => void;
}

export function PreviewPane({ previewRef, onPreviewElementChange }: PreviewPaneProps) {
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
      <PreviewContent previewRef={previewRef} onPreviewElementChange={onPreviewElementChange} />
    </section>
  );
}

function PreviewContent({
  previewRef,
  onPreviewElementChange,
}: {
  readonly previewRef: MutableRefObject<HTMLDivElement | null>;
  readonly onPreviewElementChange: (element: HTMLDivElement | null) => void;
}) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const frameCleanupRef = useRef<(() => void) | null>(null);
  const renderSequenceRef = useRef(0);
  const previousRenderContextKeyRef = useRef<string | null>(null);
  const renderedPreviewContextRef = useRef<PreviewRenderContext | null>(null);
  const renderedRendererRef = useRef<PreviewContribution | null>(null);
  const renderedEnhancementsRef = useRef<PreviewContribution[]>([]);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const theme = useSettingsStore((state) => state.theme);
  const htmlPreviewMode = useSettingsStore((state) => state.htmlPreviewMode);
  const setHtmlPreviewMode = useSettingsStore((state) => state.setHtmlPreviewMode);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const fileType = getFileTypeInfo(activeFile?.name, activeFile?.path, enabledFeatures);
  const previewContext = useMemo<PreviewRenderContext | null>(
    () =>
      activeFile
        ? { file: activeFile, fileType, theme, htmlPreviewMode, setHtmlPreviewMode }
        : null,
    [activeFile, fileType.label, fileType.language, fileType.previewKind, htmlPreviewMode, setHtmlPreviewMode, theme],
  );
  const renderer = previewContext ? selectPreviewRenderer(enabledFeatures, previewContext) : null;
  const usesBrowserFrame = previewResult?.kind === 'html' && previewResult.renderMode === 'browser-frame';
  const renderContextKey = previewContext && renderer
    ? [
        activeFile?.id ?? '',
        activeFile?.path ?? '',
        activeFile?.name ?? '',
        fileType.language,
        fileType.previewKind,
        htmlPreviewMode,
        renderer.id,
        theme,
      ].join('\n')
    : null;

  useEffect(() => {
    if (!previewContext || !renderer?.render) {
      setPreviewResult(null);
      previousRenderContextKeyRef.current = null;
      renderedPreviewContextRef.current = null;
      renderedRendererRef.current = null;
      renderedEnhancementsRef.current = [];
      return;
    }

    const render = renderer.render;
    const sequence = renderSequenceRef.current + 1;
    renderSequenceRef.current = sequence;
    let controller: AbortController | null = null;
    const shouldDebounce = previousRenderContextKeyRef.current === renderContextKey;
    previousRenderContextKeyRef.current = renderContextKey;

    const renderPreview = () => {
      controller = new AbortController();
      const renderContext = { ...previewContext, signal: controller.signal };
      void Promise.resolve(render(renderContext))
        .then((result) => {
          if (!controller?.signal.aborted && renderSequenceRef.current === sequence) {
            renderedPreviewContextRef.current = previewContext;
            renderedRendererRef.current = renderer;
            renderedEnhancementsRef.current = selectPreviewEnhancements(enabledFeatures, previewContext, previewDomEnhancements);
            setPreviewResult(result);
          }
        })
        .catch((error) => {
          if (!controller?.signal.aborted && renderSequenceRef.current === sequence) {
            console.error(`failed to render preview contribution "${renderer.id}"`, error);
            renderedPreviewContextRef.current = previewContext;
            renderedRendererRef.current = renderer;
            renderedEnhancementsRef.current = selectPreviewEnhancements(enabledFeatures, previewContext, previewDomEnhancements);
            setPreviewResult({
              kind: 'html',
              html: '<div class="preview-error-panel compact"><strong>Preview failed</strong><pre>미리보기를 렌더링하지 못했습니다.</pre></div>',
            });
          }
        });
    };

    const timer = window.setTimeout(
      renderPreview,
      shouldDebounce ? CONTENT_RENDER_DEBOUNCE_MS : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller?.abort();
    };
  }, [
    activeFile?.content,
    fileType.language,
    fileType.previewKind,
    htmlPreviewMode,
    previewContext,
    renderContextKey,
    renderer,
    theme,
  ]);

  const previewRenderKey =
    previewResult?.kind === 'react'
      ? `${renderer?.id ?? 'react'}:${previewResult.renderKey ?? activeFile?.id ?? ''}:${activeFile?.content ?? ''}`
      : previewResult?.html ?? '';
  const inlineHtml = previewResult?.kind === 'html' && !usesBrowserFrame ? previewResult.html : null;

  useLayoutEffect(() => {
    const root = localRef.current;
    if (!root || inlineHtml === null) return;
    replacePreviewHtml(root, inlineHtml);
  }, [inlineHtml]);

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

  useLayoutEffect(() => {
    const root = localRef.current;
    const renderedPreviewContext = renderedPreviewContextRef.current;
    const renderedRenderer = renderedRendererRef.current;
    const renderedEnhancements = renderedEnhancementsRef.current;
    if (!root || !renderedPreviewContext || !renderedRenderer) return;

    const controller = new AbortController();
    const renderContext = { ...renderedPreviewContext, signal: controller.signal };

    void (async () => {
      try {
        const rendererResult = renderedRenderer.afterRender?.(root, renderContext, controller.signal);
        if (isPromiseLike(rendererResult)) await rendererResult;
        for (const enhancement of renderedEnhancements) {
          if (controller.signal.aborted) return;
          const enhancementResult = enhancement.afterRender?.(root, renderContext, controller.signal);
          if (isPromiseLike(enhancementResult)) await enhancementResult;
        }
        if (!controller.signal.aborted) notifyPreviewRendered(root);
      } catch (error) {
        if (!controller.signal.aborted) console.error('failed to run preview lifecycle', error);
      }
    })();

    return () => {
      controller.abort();
      renderedRenderer.cleanup?.(root);
      renderedEnhancements.forEach((enhancement) => enhancement.cleanup?.(root));
    };
  }, [previewRenderKey]);

  const className = usesBrowserFrame ? 'preview-content html-preview-browser' : 'preview-content';
  const setPreviewElement = useCallback((element: HTMLDivElement | null) => {
    localRef.current = element;
    previewRef.current = element;
    onPreviewElementChange(element);
  }, [onPreviewElementChange, previewRef]);

  if (!activeFile) {
    return (
      <div key="empty" className={`${className} empty-document-content`} ref={setPreviewElement}>
        <EmptyState
          className="empty-document-state"
          title="아무것도 열려 있지 않습니다"
          description="파일을 열어 시작하세요."
        />
      </div>
    );
  }

  if (!previewResult) {
    return <div key="pending" className={className} ref={setPreviewElement} />;
  }

  if (usesBrowserFrame && previewResult.kind === 'html') {
    return (
      <div key="browser-frame" className={className} ref={setPreviewElement}>
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
      <div key="react" className={className} ref={setPreviewElement}>
        {previewResult.node}
      </div>
    );
  }

  return (
    <div
      key="html"
      className={className}
      ref={setPreviewElement}
    />
  );
}

function replacePreviewHtml(root: HTMLElement, html: string): void {
  const reusableImages = collectReusableImages(root);
  const template = document.createElement('template');
  template.innerHTML = html;
  reuseExistingImages(template.content, reusableImages);
  reusePreviewLayoutBlocks(root, template.content);
  root.replaceChildren(...Array.from(template.content.childNodes));
}

function collectReusableImages(root: HTMLElement): Map<string, HTMLImageElement[]> {
  const imagesByKey = new Map<string, HTMLImageElement[]>();
  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
    const key = imageReuseKey(image);
    if (!key) return;
    const images = imagesByKey.get(key) ?? [];
    images.push(image);
    imagesByKey.set(key, images);
  });
  return imagesByKey;
}

function reuseExistingImages(root: ParentNode, reusableImages: Map<string, HTMLImageElement[]>): void {
  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
    const key = imageReuseKey(image);
    const reusableImage = key ? reusableImages.get(key)?.shift() : null;
    if (!reusableImage) return;

    syncReusableImageAttributes(reusableImage, image);
    image.replaceWith(reusableImage);
  });
}

function syncReusableImageAttributes(target: HTMLImageElement, source: HTMLImageElement): void {
  const sameOriginalSrc =
    Boolean(target.getAttribute('data-original-src')) &&
    target.getAttribute('data-original-src') === source.getAttribute('data-original-src');

  Array.from(target.attributes).forEach((attribute) => {
    if (!source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
  });
  Array.from(source.attributes).forEach((attribute) => {
    if (attribute.name === 'src' && (sameOriginalSrc || target.getAttribute('src') === attribute.value)) return;
    target.setAttribute(attribute.name, attribute.value);
  });
  target.className = source.className;
}

function imageReuseKey(image: HTMLImageElement): string | null {
  const originalSrc = image.getAttribute('data-original-src');
  if (originalSrc) return originalSrc;

  const src = image.getAttribute('src');
  if (!src) return null;
  return src;
}

function isPromiseLike(value: void | Promise<void>): value is Promise<void> {
  return Boolean(value && typeof value.then === 'function');
}
