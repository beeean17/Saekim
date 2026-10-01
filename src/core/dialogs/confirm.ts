/**
 * An in-app replacement for `window.confirm`.
 *
 * The native dialog blocks the whole webview, ignores the app's theme and
 * language, and on some platforms shows the origin URL. This keeps the same
 * "ask, then continue" shape but renders as part of the app.
 */

export type ConfirmTone = 'default' | 'danger';

/**
 * Three-way answer. "discard" is the middle option a save prompt needs - the
 * native browser confirm only offers two, which is why closing an unsaved
 * document in the browser build had no way to throw the changes away.
 */
export type ConfirmChoice = 'confirm' | 'discard' | 'cancel';

export interface ConfirmRequest {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  discardLabel?: string;
  tone: ConfirmTone;
  resolve(choice: ConfirmChoice): void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Shown only when the caller offers a third, non-destructive-to-cancel path. */
  discardLabel?: string;
  tone?: ConfirmTone;
}

let request: ConfirmRequest | null = null;
let sequence = 0;
const listeners = new Set<() => void>();

export function requestChoice(options: ConfirmOptions): Promise<ConfirmChoice> {
  /* Only one question at a time; a newer one supersedes an unanswered older. */
  if (request) request.resolve('cancel');

  return new Promise<ConfirmChoice>((resolve) => {
    request = {
      id: (sequence += 1),
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      discardLabel: options.discardLabel,
      tone: options.tone ?? 'default',
      resolve,
    };
    emit();
  });
}

export async function requestConfirmation(options: ConfirmOptions): Promise<boolean> {
  return (await requestChoice(options)) === 'confirm';
}

export function getConfirmRequest(): ConfirmRequest | null {
  return request;
}

export function subscribeConfirmRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resolveConfirmation(choice: ConfirmChoice): void {
  const current = request;
  if (!current) return;
  request = null;
  emit();
  current.resolve(choice);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}
