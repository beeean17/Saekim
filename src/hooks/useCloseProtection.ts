import { useCallback, useEffect, useRef } from 'react';
import { Backend } from '../platform/common/backend';
import { isDirty, useWorkspaceStore } from '../store/workspace';
import type { OpenFile } from '../types/workspace';

export function useCloseProtection(): () => Promise<void> {
  const closeRequestInProgress = useRef(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void Backend.runtime.listenCloseRequests(async ({ reason }) => {
      if (disposed || closeRequestInProgress.current) return;
      closeRequestInProgress.current = true;

      try {
        const dirtyFiles = useWorkspaceStore.getState().openFiles.filter(isDirty);
        const approved = await approveClosingFiles(dirtyFiles);
        await Backend.runtime.respondToCloseRequest(reason, approved);
      } catch (error) {
        console.error('닫기 요청 처리 실패:', error);
        await Backend.runtime.respondToCloseRequest(reason, false).catch(() => undefined);
      } finally {
        closeRequestInProgress.current = false;
      }
    }).then((stopListening) => {
      if (disposed) stopListening();
      else unlisten = stopListening;
    }).catch((error) => console.error('닫기 요청 리스너 등록 실패:', error));

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return useCallback(async () => {
    try {
      const state = useWorkspaceStore.getState();
      const file = state.openFiles.find((candidate) => candidate.id === state.activeFileId);
      if (!file) {
        await Backend.runtime.runWindowAction('close');
        return;
      }
      await closeFileWithProtection(file.id);
    } catch (error) {
      console.error('파일 닫기 요청 처리 실패:', error);
    }
  }, []);
}

export async function closeFileWithProtection(fileId: string): Promise<boolean> {
  const file = useWorkspaceStore.getState().openFiles.find((candidate) => candidate.id === fileId);
  if (!file) return false;

  let closingFileId = file.id;
  if (isDirty(file)) {
    const decision = await Backend.runtime.confirmUnsavedChanges([file.name]);
    if (decision === 'cancel') return false;
    if (decision === 'save') {
      const savedPath = await useWorkspaceStore.getState().saveFile(file.id);
      if (!savedPath) return false;
      closingFileId = savedPath;
    } else {
      await Backend.metadata.deleteDocumentDraft(file.path);
    }
  }

  useWorkspaceStore.getState().closeFile(closingFileId);
  return true;
}

async function approveClosingFiles(dirtyFiles: OpenFile[]): Promise<boolean> {
  if (dirtyFiles.length === 0) return true;

  const decision = await Backend.runtime.confirmUnsavedChanges(dirtyFiles.map((file) => file.name));
  if (decision === 'cancel') return false;
  if (decision === 'discard') {
    await Promise.all(dirtyFiles.map((file) => Backend.metadata.deleteDocumentDraft(file.path)));
    return true;
  }

  for (const file of dirtyFiles) {
    const latest = useWorkspaceStore.getState().openFiles.find((candidate) => candidate.id === file.id);
    if (!latest || !isDirty(latest)) continue;
    const savedPath = await useWorkspaceStore.getState().saveFile(latest.id);
    if (!savedPath) return false;
  }

  return true;
}
