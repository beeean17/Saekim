import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { PreviewRenderContext, PreviewResult } from '../../app/feature';
import { enabledFeatures } from '../../app/featureRegistry';
import { getFileTypeInfo } from '../../core/document/fileType';
import { bindHtmlPreviewFrame, notifyPreviewRendered } from '../../core/preview/domLifecycle';
import { selectPreviewEnhancements, selectPreviewRenderer } from '../../core/preview/registry';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { Icon } from '../primitives/Icon';
import { EmptyState } from '../ui/feedback/EmptyState';
import { ToolbarButton } from '../ui/toolbar/Toolbar';

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
    enhancementIds,
    previewContext,
    previewRenderKey,
    renderer,
  ]);

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
