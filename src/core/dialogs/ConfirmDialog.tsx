import { useSyncExternalStore } from 'react';
import './confirmDialog.css';
import type { AppOverlayProps } from '../../app/feature';
import { Dialog, DialogActions } from '../../components/ui/overlay/Dialog';
import { Button } from '../../components/ui/primitives/Button';
import { getConfirmRequest, resolveConfirmation, subscribeConfirmRequest } from './confirm';

export function ConfirmDialog(_props: AppOverlayProps) {
  const request = useSyncExternalStore(subscribeConfirmRequest, getConfirmRequest, () => null);

  return (
    <Dialog
      backdropClassName="confirm-dialog-backdrop"
      className="confirm-dialog"
      closeOnBackdrop={false}
      open={Boolean(request)}
      title={request?.title ?? ''}
      onClose={() => resolveConfirmation('cancel')}
    >
      <h2 className="confirm-dialog-title">{request?.title}</h2>
      <p className="confirm-dialog-message">{request?.message}</p>
      {/* Cancel is focused first, so Enter or Escape both keep the user's work. */}
      <DialogActions>
        <Button variant="surface" onClick={() => resolveConfirmation('cancel')}>
          {request?.cancelLabel}
        </Button>
        {request?.discardLabel ? (
          <Button
            className="confirm-dialog-discard"
            variant="surface"
            onClick={() => resolveConfirmation('discard')}
          >
            {request.discardLabel}
          </Button>
        ) : null}
        <Button
          className={request?.tone === 'danger' ? 'confirm-dialog-danger' : undefined}
          variant="primary"
          onClick={() => resolveConfirmation('confirm')}
        >
          {request?.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
