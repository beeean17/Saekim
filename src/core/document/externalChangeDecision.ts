export type ExternalChangeDecision = 'overwrite' | 'reload' | 'save-as' | 'cancel';

export interface ExternalChangeRequest {
  fileName: string;
  resolve(decision: ExternalChangeDecision): void;
}

let request: ExternalChangeRequest | null = null;
const listeners = new Set<() => void>();

export function requestExternalChangeDecision(fileName: string): Promise<ExternalChangeDecision> {
  if (request) request.resolve('cancel');
  return new Promise((resolve) => {
    request = { fileName, resolve };
    emitChange();
  });
}

export function getExternalChangeRequest(): ExternalChangeRequest | null {
  return request;
}

export function subscribeExternalChangeRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resolveExternalChangeDecision(decision: ExternalChangeDecision): void {
  const current = request;
  if (!current) return;
  request = null;
  emitChange();
  current.resolve(decision);
}

function emitChange(): void {
  listeners.forEach((listener) => listener());
}
