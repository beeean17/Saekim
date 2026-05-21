import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../../lib/markdown/renderer';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { Icon } from '../primitives/Icon';

export function PreviewPane({ previewRef }: { previewRef: React.MutableRefObject<HTMLDivElement | null> }) {
  const syncScroll = useUIStore((state) => state.syncScroll);
  const toggleSyncScroll = useUIStore((state) => state.toggleSyncScroll);

  return (
    <section className="preview-pane">
      <div className="preview-head">
        <span className="label">미리보기</span>
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
  const activeFile = useWorkspaceStore(selectActiveFile);
  const theme = useSettingsStore((state) => state.theme);
  const deferredContent = useDeferredValue(activeFile?.content ?? '');
  const renderVersionRef = useRef(0);
  const [html, setHtml] = useState('');

  const notifyRendered = () => {
    const root = localRef.current;
    if (!root) return;

    window.requestAnimationFrame(() => {
      root.dispatchEvent(new CustomEvent('saekim-preview-rendered', { bubbles: true }));
    });
  };

  useEffect(() => {
    const renderVersion = renderVersionRef.current + 1;
    renderVersionRef.current = renderVersion;
    const mode = theme === 'dark' || theme === 'nord' ? 'dark' : 'light';
    void renderMarkdown(deferredContent, mode).then((nextHtml) => {
      if (renderVersionRef.current === renderVersion) setHtml(nextHtml);
    });
  }, [deferredContent, theme]);

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
        blocks.map((block, index) => {
          const source = decodeURIComponent(block.dataset.source || '');
          const id = `mermaid-${Date.now()}-${index}`;
          return mermaid.render(id, source).then(({ svg }) => {
            if (alive) block.innerHTML = svg;
          });
        }),
      ).then(() => {
        if (alive) notifyRendered();
      });
    });

    return () => {
      alive = false;
    };
  }, [html, theme]);

  useEffect(() => {
    notifyRendered();
  }, [html]);

  return (
    <div
      className="preview-content"
      ref={(element) => {
        localRef.current = element;
        previewRef.current = element;
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
