import { useEffect, useMemo, useState } from 'react';
import type { AppOverlayProps } from '../../app/feature';
import { Dialog, DialogActions } from '../../components/ui/overlay/Dialog';
import { Button } from '../../components/ui/primitives/Button';
import { useI18n } from '../../i18n/useI18n';
import { notify, notifyError } from '../../core/notifications';
import { Backend } from '../../platform/common/backend';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import type { DocumentSnapshot, DocumentSnapshotSummary } from '../../types/metadata';
import { fiveMinutesInMilliseconds, snapshotAtOrBefore } from './history';
import { useVersionHistoryStore } from './store';

export function VersionHistoryDialog(_props: AppOverlayProps) {
  const { language, t } = useI18n();
  const isOpen = useVersionHistoryStore((state) => state.isOpen);
  const close = useVersionHistoryStore((state) => state.close);
  const activeFile = useWorkspaceStore(selectActiveFile);
  const activeFilePath = activeFile?.path ?? null;
  const restoreDocumentSnapshot = useWorkspaceStore((state) => state.restoreDocumentSnapshot);
  const [snapshots, setSnapshots] = useState<DocumentSnapshotSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<DocumentSnapshot | null>(null);

  useEffect(() => {
    if (!isOpen || !activeFilePath) return;
    let alive = true;
    setLoading(true);
    setNotice(null);
    setSnapshots([]);
    setSelectedId(null);
    setSelectedSnapshot(null);
    void Backend.metadata.listDocumentSnapshots(activeFilePath)
      .then((items) => {
        if (!alive) return;
        setSnapshots(items);
        setSelectedId(items[0]?.id ?? null);
        if (items.length === 0) setNotice(t('history.empty'));
      })
      .catch((error) => {
        if (!alive) return;
        console.error('Failed to load local version history:', error);
        notifyError(t('history.loadFailed'), error);
        setNotice(t('history.loadFailed'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeFilePath, isOpen, t]);

  useEffect(() => {
    if (!isOpen || !selectedId) {
      setSelectedSnapshot(null);
      return;
    }
    let alive = true;
    void Backend.metadata.loadDocumentSnapshot(selectedId)
      .then((snapshot) => {
        if (alive) setSelectedSnapshot(snapshot);
      })
      .catch((error) => {
        console.error('Failed to load local document snapshot:', error);
        if (alive) setNotice(t('history.loadFailed'));
      });
    return () => {
      alive = false;
    };
  }, [isOpen, selectedId, t]);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'medium', timeStyle: 'medium' }),
    [language],
  );

  /*
   * Restoring replaces whatever is in the editor right now, so it asks first
   * and then says what it did. The replacement itself is an undoable edit, and
   * the notification repeats that, because "I clicked the wrong version" used
   * to be unrecoverable.
   */
  const restore = async (snapshot: DocumentSnapshot | null) => {
    if (!activeFile || !snapshot) return;
    restoreDocumentSnapshot(activeFile.id, snapshot);
    notify(t('history.restored', { time: formatter.format(snapshot.createdAt) }), { tone: 'success' });
    setPendingRestore(null);
    close();
  };

  const restoreFiveMinutesAgo = async () => {
    const target = snapshotAtOrBefore(snapshots, Date.now() - fiveMinutesInMilliseconds);
    if (!target) {
      setNotice(t('history.noFiveMinuteSnapshot'));
      return;
    }
    setLoading(true);
    try {
      const snapshot = await Backend.metadata.loadDocumentSnapshot(target.id);
      if (!snapshot) {
        setNotice(t('history.loadFailed'));
        return;
      }
      setPendingRestore(snapshot);
    } catch (error) {
      console.error('Failed to restore five-minute snapshot:', error);
      setNotice(t('history.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      backdropClassName="version-history-backdrop"
      className="version-history-dialog"
      open={isOpen}
      title={t('history.title')}
      onClose={close}
    >
      <header className="version-history-header">
        <div>
          <h2>{t('history.title')}</h2>
          <p>{activeFile ? t('history.description', { name: activeFile.name }) : t('history.noDocument')}</p>
        </div>
        <Button aria-label={t('common.close')} size="sm" onClick={close}>×</Button>
      </header>
      <div className="version-history-body">
        <div
          className="version-history-list"
          role="listbox"
          aria-label={t('history.snapshots')}
          /* Arrow keys walk the list, as a listbox is expected to. */
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const index = snapshots.findIndex((candidate) => candidate.id === selectedId);
            const nextIndex = Math.min(
              snapshots.length - 1,
              Math.max(0, (index < 0 ? 0 : index) + (event.key === 'ArrowDown' ? 1 : -1)),
            );
            const next = snapshots[nextIndex];
            if (!next) return;
            setNotice(null);
            setSelectedId(next.id);
            event.currentTarget
              .querySelector<HTMLElement>(`[data-snapshot-id="${next.id}"]`)
              ?.focus();
          }}
        >
          {snapshots.map((snapshot) => (
            <button
              aria-selected={snapshot.id === selectedId}
              className="version-history-item"
              data-snapshot-id={snapshot.id}
              key={snapshot.id}
              role="option"
              type="button"
              onClick={() => {
                setNotice(null);
                setSelectedId(snapshot.id);
              }}
            >
              <strong>{formatter.format(snapshot.createdAt)}</strong>
              <span>{t(snapshot.source === 'saved' ? 'history.saved' : 'history.autosave')}</span>
              <span>{t('history.characters', { count: snapshot.characterCount })}</span>
            </button>
          ))}
          {loading && snapshots.length === 0 ? <p className="version-history-notice">{t('history.loading')}</p> : null}
        </div>
        <pre className="version-history-preview" aria-label={t('history.preview')}>
          {selectedSnapshot?.content ?? ''}
        </pre>
      </div>
      {notice ? <p className="version-history-notice" role="status">{notice}</p> : null}
      <DialogActions>
        <Button disabled={!activeFile || loading} variant="surface" onClick={() => void restoreFiveMinutesAgo()}>
          {t('history.restoreFiveMinutes')}
        </Button>
        <Button
          disabled={!selectedSnapshot || loading}
          variant="primary"
          onClick={() => setPendingRestore(selectedSnapshot)}
        >
          {t('history.restoreSelected')}
        </Button>
      </DialogActions>

      <Dialog
        className="version-history-confirm"
        open={pendingRestore !== null}
        title={t('history.restoreSelected')}
        onClose={() => setPendingRestore(null)}
      >
        <p className="version-history-confirm-copy">{t('history.restoreConfirm')}</p>
        <DialogActions>
          <Button variant="surface" onClick={() => setPendingRestore(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void restore(pendingRestore)}>
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
