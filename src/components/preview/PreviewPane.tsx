import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../../lib/markdown/renderer';
import { isExternalUrl, openExternalUrl } from '../../lib/tauri/opener';
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
  const [html, setHtml] = useState('');

  useEffect(() => {
    let alive = true;
    const mode = theme === 'dark' || theme === 'nord' ? 'dark' : 'light';
    void renderMarkdown(activeFile?.content ?? '', mode).then((nextHtml) => {
      if (alive) setHtml(nextHtml);
    });
    return () => {
      alive = false;
    };
  }, [activeFile?.content, theme]);

  useLayoutEffect(() => {
    notifyPreviewRendered(localRef.current);
  }, [html]);

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

function notifyPreviewRendered(root: HTMLDivElement | null): void {
  root?.dispatchEvent(new CustomEvent('saekim-preview-rendered', { bubbles: false }));
}
