import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { PreviewRenderContext } from '../../app/feature';
import { getFileTypeInfo } from '../../core/document/fileType';
import { selectPreviewEnhancements, selectPreviewRenderer } from '../../core/preview/registry';
import { PreviewDomLifecycle, PreviewRenderTask } from '../../core/preview/renderSession';
import type { PreviewRenderSnapshot } from '../../core/preview/renderTypes';
import { PreviewSurface } from '../../platform/common/previewSurface';
import { enabledFeatures } from '../../app/featureRegistry';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { EmptyState } from '../ui/feedback/EmptyState';
import { bindHtmlPreviewFrame, notifyPreviewRendered, previewDomEnhancements } from './domLifecycle';
import { replacePreviewHtml } from './htmlReplacement';
import { PreviewSurfaceRoot } from './PreviewSurfaceRoot';

interface PreviewContentProps {
  readonly previewRef: MutableRefObject<HTMLDivElement | null>;
  readonly onPreviewElementChange: (element: HTMLDivElement | null) => void;
}

export function PreviewContent({ previewRef, onPreviewElementChange }: PreviewContentProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const frameCleanupRef = useRef<(() => void) | null>(null);
  const previousRenderContextKeyRef = useRef<string | null>(null);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const theme = useSettingsStore((state) => state.resolvedTheme);
  const htmlPreviewMode = useSettingsStore((state) => state.htmlPreviewMode);
  const setHtmlPreviewMode = useSettingsStore((state) => state.setHtmlPreviewMode);
  const previewInteractionMode = useUIStore((state) => state.previewInteractionMode);
  const [renderSnapshot, setRenderSnapshot] = useState<PreviewRenderSnapshot | null>(null);
  const fileType = getFileTypeInfo(activeFile?.name, activeFile?.path, enabledFeatures);
  const previewContext = useMemo<PreviewRenderContext | null>(
    () =>
      activeFile
        ? { file: activeFile, fileType, theme, htmlPreviewMode, setHtmlPreviewMode }
        : null,
    [activeFile, fileType.label, fileType.language, fileType.previewKind, htmlPreviewMode, setHtmlPreviewMode, theme],
  );
  const renderer = previewContext ? selectPreviewRenderer(enabledFeatures, previewContext) : null;
  const previewResult = renderSnapshot?.result ?? null;
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
    if (!previewContext || !renderer || !renderContextKey) {
      setRenderSnapshot(null);
      previousRenderContextKeyRef.current = null;
      return;
    }

    const shouldDebounce = previousRenderContextKeyRef.current === renderContextKey;
    previousRenderContextKeyRef.current = renderContextKey;
    const task = new PreviewRenderTask({
      context: previewContext,
      renderer,
      enhancements: selectPreviewEnhancements(enabledFeatures, previewContext, previewDomEnhancements),
      delayMs: shouldDebounce ? PreviewSurface.policy.render.debounceMs : 0,
      onComplete: setRenderSnapshot,
      onError: logPreviewError,
    });

    task.start();
    return () => task.cancel();
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
      ? `${renderer?.id ?? 'react'}:${previewResult.renderKey ?? activeFile?.id ?? ''}`
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
    if (!root || !renderSnapshot) return;

    const lifecycle = new PreviewDomLifecycle({
      root,
      snapshot: renderSnapshot,
      onRendered: notifyPreviewRendered,
      onError: logPreviewError,
    });
    lifecycle.start();
    return () => lifecycle.cleanup();
  }, [previewInteractionMode, previewRenderKey, renderSnapshot]);

  const className = usesBrowserFrame
    ? `preview-content html-preview-browser preview-surface-${PreviewSurface.target}`
    : `preview-content preview-surface-${PreviewSurface.target}`;
  const setPreviewElement = useCallback((element: HTMLDivElement | null) => {
    localRef.current = element;
    previewRef.current = element;
    onPreviewElementChange(element);
  }, [onPreviewElementChange, previewRef]);

  if (!activeFile) {
    return (
      <PreviewSurfaceRoot
        key="empty"
        className={`${className} empty-document-content`}
        interactionMode={previewInteractionMode}
        onMount={setPreviewElement}
      >
        <EmptyState
          className="empty-document-state"
          title="아무것도 열려 있지 않습니다"
          description="파일을 열어 시작하세요."
        />
      </PreviewSurfaceRoot>
    );
  }

  if (!previewResult) {
    return (
      <PreviewSurfaceRoot
        key="pending"
        className={className}
        interactionMode={previewInteractionMode}
        onMount={setPreviewElement}
      />
    );
  }

  if (usesBrowserFrame && previewResult.kind === 'html') {
    return (
      <PreviewSurfaceRoot
        key="browser-frame"
        className={className}
        interactionMode={previewInteractionMode}
        onMount={setPreviewElement}
      >
        <iframe
          ref={frameRef}
          className="html-preview-frame"
          sandbox="allow-same-origin"
          srcDoc={previewResult.html}
          title="HTML 미리보기"
          onLoad={() => bindHtmlPreviewFrame(frameRef.current, localRef.current, frameCleanupRef)}
        />
      </PreviewSurfaceRoot>
    );
  }

  if (previewResult.kind === 'react') {
    return (
      <PreviewSurfaceRoot
        key="react"
        className={className}
        interactionMode={previewInteractionMode}
        onMount={setPreviewElement}
      >
        {previewResult.node}
      </PreviewSurfaceRoot>
    );
  }

  return (
    <PreviewSurfaceRoot
      key="html"
      className={className}
      interactionMode={previewInteractionMode}
      onMount={setPreviewElement}
    />
  );
}

function logPreviewError(message: string, error: Error): void {
  console.error(message, error);
}
