import { useEffect } from 'react';
import { Backend } from '../platform/common/backend';
import { isDirty } from '../store/workspace';
import type { OpenFile } from '../types/workspace';

export function useWindowDocumentState(activeFile: OpenFile | null): void {
  const edited = isDirty(activeFile);
  const name = activeFile?.name;
  const path = activeFile?.path.startsWith('~') ? undefined : activeFile?.path;

  useEffect(() => {
    const title = name ? `${name} — Saekim` : 'Saekim';
    void Backend.runtime.setWindowDocumentState(title, edited, path).catch((error) => {
      console.warn('창 문서 상태 동기화 실패:', error);
    });
  }, [edited, name, path]);
}
