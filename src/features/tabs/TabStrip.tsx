import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatShortcut } from '../../app/commands';
import { closeFileWithProtection } from '../../hooks/useCloseProtection';
import { isDirty, useWorkspaceStore } from '../../store/workspace';
import type { OpenFile } from '../../types/workspace';
import { Icon } from '../../components/primitives/Icon';
import { IconButton } from '../../components/ui/primitives/IconButton';
import { MenuSurface } from '../../components/ui/surface/MenuSurface';
import { notifyError } from '../../core/notifications';
import { useViewportProfile } from '../../hooks/useViewportProfile';
import { useI18n } from '../../i18n/useI18n';

export function TabStrip() {
  const { t } = useI18n();
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const activeFileId = useWorkspaceStore((state) => state.activeFileId);
  const setActiveFile = useWorkspaceStore((state) => state.setActiveFile);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const compact = useViewportProfile().profile === 'compact';

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeFileId]);

  /*
   * Once tabs stop fitting, horizontal scrolling alone hides documents with no
   * hint that they exist. Watch for that and offer a list of everything open.
   */
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = () => setOverflowing(strip.scrollWidth > strip.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [openFiles.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: Event) => {
      if (event.target instanceof Node && stripRef.current?.parentElement?.contains(event.target)) return;
      setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  /*
   * On a phone the chrome already eats a fifth of the screen. A tab strip
   * holding a single tab repeats the file name that is right above it in the
   * title bar, so it earns its space only once there is something to switch
   * between.
   */
  if (openFiles.length === 0) return null;
  if (compact && openFiles.length === 1) return null;

  return (
    <div className="document-tab-bar">
      <div className="document-tab-strip" ref={stripRef} role="tablist" aria-label={t('tabs.openDocuments')}>
        {openFiles.map((file, index) => {
          const active = file.id === activeFileId;
          /* The wrapper is presentational so the tablist's children are the
             tabs themselves, not the close buttons sitting beside them. */
          return (
            <div className="document-tab" data-active={active} key={file.id} role="presentation">
              <button
                aria-selected={active}
                className="document-tab-select"
                ref={active ? activeTabRef : undefined}
                role="tab"
                tabIndex={active ? 0 : -1}
                title={`${file.name}${index < 9 ? ` (${formatShortcut(`mod+${index + 1}`)})` : ''}`}
                type="button"
                onAuxClick={(event) => {
                  if (event.button === 1) void requestClose(file, t('tabs.close'));
                }}
                onClick={() => setActiveFile(file.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                  event.preventDefault();
                  const delta = event.key === 'ArrowRight' ? 1 : -1;
                  const next = openFiles[(index + delta + openFiles.length) % openFiles.length];
                  if (next) setActiveFile(next.id);
                }}
              >
                <span className="document-tab-name">{file.name}</span>
                {isDirty(file) ? <span aria-label={t('document.unsavedChanges')} className="document-tab-dirty" /> : null}
              </button>
              <button
                aria-label={t('tabs.closeNamed', { name: file.name })}
                className="document-tab-close"
                title={t('tabs.close')}
                type="button"
                onClick={() => void requestClose(file, t('tabs.close'))}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {overflowing ? (
        <div className="document-tab-overflow">
          <IconButton
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="document-tab-overflow-button"
            label={t('tabs.overflow')}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name="chevronDown" />
          </IconButton>
          {menuOpen ? (
            <MenuSurface className="document-tab-overflow-menu" role="menu">
              {openFiles.map((file) => (
                <button
                  className="app-menu-item"
                  key={file.id}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setActiveFile(file.id);
                    setMenuOpen(false);
                  }}
                >
                  <span className="app-menu-check">{file.id === activeFileId ? '✓' : ''}</span>
                  <span className="app-menu-label">{file.name}</span>
                  {isDirty(file) ? <span className="document-tab-dirty" /> : null}
                </button>
              ))}
            </MenuSurface>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

async function requestClose(file: OpenFile, failureMessage: string): Promise<void> {
  try {
    await closeFileWithProtection(file.id);
  } catch (error) {
    console.error('탭 닫기 실패:', error);
    notifyError(failureMessage, error);
  }
}
