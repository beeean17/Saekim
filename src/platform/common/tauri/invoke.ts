import { invoke, isTauri } from '@tauri-apps/api/core';
import type { CommandResult } from '../../../types/workspace';

export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const result = await invoke<CommandResult<T>>(command, args);
  if (!result.success) {
    throw new Error(result.error || `${command} failed`);
  }
  return result.data as T;
}

export function isTauriRuntime(): boolean {
  return isTauri();
}
