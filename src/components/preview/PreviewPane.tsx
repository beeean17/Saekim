import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { getFileTypeInfo } from '../../lib/fileType';
import { renderBrowserHtmlDocument, renderSafeHtmlDocument } from '../../lib/html/renderHtml';
import { escapeHtml } from '../../lib/markdown/escape';
import { renderMarkdown } from '../../lib/markdown/renderer';
import { isExternalUrl, openExternalUrl } from '../../lib/tauri/opener';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
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
  const fileType = getFileTypeInfo(activeFile?.name, activeFile?.path);
  const usesBrowserFrame = fileType.previewKind === 'html' && htmlPreviewMode === 'browser';
  const usesStructuredPreview = fileType.previewKind === 'structured-data' || fileType.previewKind === 'tabular-data';

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
