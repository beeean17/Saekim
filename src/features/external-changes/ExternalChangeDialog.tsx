import { useSyncExternalStore } from 'react';
import type { AppOverlayProps } from '../../app/feature';
import {
  getExternalChangeRequest,
  resolveExternalChangeDecision,
  subscribeExternalChangeRequest,
} from '../../core/document/externalChangeDecision';
import { Dialog, DialogActions } from '../../components/ui/overlay/Dialog';
import { Button } from '../../components/ui/primitives/Button';
import { useI18n } from '../../i18n/useI18n';

export function ExternalChangeDialog(_props: AppOverlayProps) {
  const { t } = useI18n();
  const request = useSyncExternalStore(subscribeExternalChangeRequest, getExternalChangeRequest, () => null);

  return (
    <Dialog
      backdropClassName="external-change-dialog-backdrop"
      className="external-change-dialog"
      open={Boolean(request)}
      title={t('external.title')}
      closeOnBackdrop={false}
      onClose={() => resolveExternalChangeDecision('cancel')}
    >
      <div className="external-change-dialog-copy">
        <h2>{t('external.heading')}</h2>
        <p>
          {t('external.description', { name: request?.fileName ?? '' })}
        </p>
        <p className="external-change-dialog-warning">{t('external.overwriteHint')}</p>
      </div>
      {/*
        Cancel comes first and is the button that receives initial focus, so the
        dialog opens on the choice that cannot lose anyone's work. Overwrite is
        the destructive option and is styled as such rather than as the default.
      */}
      <DialogActions>
        <Button variant="ghost" onClick={() => resolveExternalChangeDecision('cancel')}>
          {t('external.cancel')}
        </Button>
        <Button variant="surface" onClick={() => resolveExternalChangeDecision('save-as')}>
          {t('external.saveAs')}
        </Button>
        <Button variant="surface" onClick={() => resolveExternalChangeDecision('reload')}>
          {t('external.reload')}
        </Button>
        <Button
          className="ui-button-danger"
          variant="surface"
          onClick={() => resolveExternalChangeDecision('overwrite')}
        >
          {t('external.overwrite')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
