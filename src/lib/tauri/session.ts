import { invokeCommand, isTauriRuntime } from './invoke';

export async function loadSession<T>(): Promise<T | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<T | null>('load_session');
}

export async function saveSession<T>(session: T): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeCommand<null>('save_session', { session });
}
