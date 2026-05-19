import { useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../../lib/markdown/renderer';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { Icon } from '../primitives/Icon';

export function PreviewPane() {
  return (
    <section className="preview-pane">
      <div className="preview-head">
        <span className="label">미리보기</span>
        <ViewToggle />
      </div>
      <PreviewContent />
    </section>
  );
}

function ViewToggle() {
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);

  return (
    <div className="view-toggle">
      <button className={viewMode === 'edit' ? 'active' : ''} title="편집기만" type="button" onClick={() => setViewMode('edit')}>
        <Icon name="edit" />
        편집
      </button>
      <button className={viewMode === 'split' ? 'active' : ''} title="분할 보기" type="button" onClick={() => setViewMode('split')}>
        <Icon name="split" />
        분할
      </button>
      <button className={viewMode === 'preview' ? 'active' : ''} title="미리보기만" type="button" onClick={() => setViewMode('preview')}>
        <Icon name="eye" />
        보기
      </button>
    </div>
  );
}

function PreviewContent() {
  const ref = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const root = ref.current;
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

      blocks.forEach((block, index) => {
        const source = decodeURIComponent(block.dataset.source || '');
        const id = `mermaid-${Date.now()}-${index}`;
        void mermaid.render(id, source).then(({ svg }) => {
          if (alive) block.innerHTML = svg;
        });
      });
    });

    return () => {
      alive = false;
    };
  }, [html, theme]);

  return <div className="preview-content" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
