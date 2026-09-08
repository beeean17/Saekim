import { invokeCommand, isTauriRuntime } from './invoke';
import type { BlockLayout, DocumentSnapshot, DocumentSnapshotSummary } from '../../../types/metadata';
import type { WorkspaceSession } from '../../../types/session';
import type { SessionSaveScope } from '../BackendAdapter';

export async function loadSession<T>(): Promise<T | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<T | null>('load_session');
}

export async function saveSession<T>(session: T, scope: SessionSaveScope): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeCommand<null>('save_session', { session, scope });
}

export async function deleteDocumentDraft(filePath: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeCommand<null>('delete_document_draft', { filePath });
}

export async function listDocumentSnapshots(filePath: string): Promise<DocumentSnapshotSummary[]> {
  if (!isTauriRuntime()) return [];
  return invokeCommand<DocumentSnapshotSummary[]>('list_document_snapshots', { filePath });
}

export async function loadDocumentSnapshot(snapshotId: string): Promise<DocumentSnapshot | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<DocumentSnapshot | null>('load_document_snapshot', { snapshotId });
}

export async function loadWorkspaceSession(workspacePath: string): Promise<WorkspaceSession | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<WorkspaceSession | null>('load_workspace_session', { workspacePath });
}

export async function loadBlockLayouts(filePath: string): Promise<BlockLayout[]> {
  if (!isTauriRuntime()) return [];
  return invokeCommand<BlockLayout[]>('load_block_layouts', { filePath });
}

export async function saveBlockLayout(layout: BlockLayout): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeCommand<null>('save_block_layout', { layout });
}

export async function saveBlockLayouts(layouts: readonly BlockLayout[]): Promise<void> {
  if (!isTauriRuntime() || layouts.length === 0) return;
  await invokeCommand<null>('save_block_layouts', { layouts });
}
