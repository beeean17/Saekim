/**
 * Per-document undo/redo.
 *
 * A controlled textarea loses the browser's native undo stack the moment React
 * writes `value` from outside a keystroke, which is what every programmatic
 * edit does (replace all, snapshot restore, image insertion). So the editor
 * keeps its own stack instead of borrowing the platform's.
 *
 * The stack lives here rather than in the workspace store because it is
 * session-local scratch state: it must not be written into the persisted
 * document session.
 */

export interface EditSnapshot {
  content: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Consecutive edits of the same kind inside the coalesce window collapse into
 * one undo step, so undo does not walk back one character at a time. A
 * `commit` edit always starts a new step.
 */
export type EditKind = 'type' | 'delete' | 'commit';

interface DocumentHistory {
  past: EditSnapshot[];
  future: EditSnapshot[];
  present: EditSnapshot;
  lastKind: EditKind | null;
  lastAt: number;
}

const COALESCE_WINDOW_MS = 600;
const MAX_HISTORY_ENTRIES = 200;

const histories = new Map<string, DocumentHistory>();
const listeners = new Set<() => void>();

export function subscribeEditHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function resetEditHistory(documentId: string, snapshot: EditSnapshot): void {
  histories.set(documentId, {
    past: [],
    future: [],
    present: snapshot,
    lastKind: null,
    lastAt: 0,
  });
  emit();
}

export function forgetEditHistory(documentId: string): void {
  if (histories.delete(documentId)) emit();
}

/** Keeps history addressed by id when a Save As changes the document id. */
export function renameEditHistory(previousId: string, nextId: string): void {
  if (previousId === nextId) return;
  const history = histories.get(previousId);
  if (!history) return;
  histories.delete(previousId);
  histories.set(nextId, history);
  emit();
}

export function recordEdit(
  documentId: string,
  snapshot: EditSnapshot,
  kind: EditKind = 'commit',
  now = Date.now(),
): void {
  const history = histories.get(documentId);
  if (!history) {
    resetEditHistory(documentId, snapshot);
    return;
  }
  if (history.present.content === snapshot.content) {
    /* Selection-only movement is not an undo step, but remember it so undo
       returns the caret to where the user actually left it. */
    history.present = snapshot;
    return;
  }

  const coalesces =
    kind !== 'commit' &&
    history.lastKind === kind &&
    now - history.lastAt <= COALESCE_WINDOW_MS &&
    history.past.length > 0;

  if (!coalesces) {
    history.past.push(history.present);
    if (history.past.length > MAX_HISTORY_ENTRIES) history.past.shift();
  }

  history.present = snapshot;
  history.future = [];
  history.lastKind = kind;
  history.lastAt = now;
  emit();
}

export function canUndoEdit(documentId: string | null): boolean {
  if (!documentId) return false;
  return (histories.get(documentId)?.past.length ?? 0) > 0;
}

export function canRedoEdit(documentId: string | null): boolean {
  if (!documentId) return false;
  return (histories.get(documentId)?.future.length ?? 0) > 0;
}

export function undoEdit(documentId: string): EditSnapshot | null {
  const history = histories.get(documentId);
  const previous = history?.past.pop();
  if (!history || !previous) return null;

  history.future.unshift(history.present);
  history.present = previous;
  history.lastKind = null;
  emit();
  return previous;
}

export function redoEdit(documentId: string): EditSnapshot | null {
  const history = histories.get(documentId);
  const next = history?.future.shift();
  if (!history || !next) return null;

  history.past.push(history.present);
  history.present = next;
  history.lastKind = null;
  emit();
  return next;
}

/** Classifies a textarea change so typing runs collapse into single undo steps. */
export function classifyEdit(previousContent: string, nextContent: string): EditKind {
  const delta = nextContent.length - previousContent.length;
  if (delta === 1) return 'type';
  if (delta === -1) return 'delete';
  return 'commit';
}
