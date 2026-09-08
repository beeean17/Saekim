import { useSyncExternalStore } from 'react';
import type { AppOverlayProps } from '../../app/feature';
import {
  getExternalChangeRequest,
  resolveExternalChangeDecision,
  subscribeExternalChangeRequest,
} from '../../core/document/externalChangeDecision';
import { Dialog, DialogActions } from '../../components/ui/overlay/Dialog';
import { Button } from '../../components/ui/primitives/Button';

export function ExternalChangeDialog(_props: AppOverlayProps) {
  const request = useSyncExternalStore(subscribeExternalChangeRequest, getExternalChangeRequest, () => null);

  return (
    <Dialog
      backdropClassName="external-change-dialog-backdrop"
      className="external-change-dialog"
      open={Boolean(request)}
      title="외부 변경 충돌"
      closeOnBackdrop={false}
      onClose={() => resolveExternalChangeDecision('cancel')}
    >
      <div className="external-change-dialog-copy">
        <h2>파일이 외부에서 변경되었습니다</h2>
        <p>
          <strong>{request?.fileName}</strong>의 디스크 버전이 파일을 연 뒤 변경되었습니다. 현재 편집 내용을 어떻게 처리할까요?
        </p>
      </div>
      <DialogActions>
        <Button variant="surface" onClick={() => resolveExternalChangeDecision('reload')}>다시 불러오기</Button>
        <Button variant="surface" onClick={() => resolveExternalChangeDecision('save-as')}>다른 이름으로 저장</Button>
        <Button variant="primary" onClick={() => resolveExternalChangeDecision('overwrite')}>덮어쓰기</Button>
      </DialogActions>
    </Dialog>
  );
}
