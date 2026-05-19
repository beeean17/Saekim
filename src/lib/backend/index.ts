import { isTauriRuntime } from '../tauri/invoke';
import { browserBackend } from './browserBackend';
import { tauriBackend } from './tauriBackend';
import type { BackendAdapter } from './types';

export const Backend: BackendAdapter = isTauriRuntime() ? tauriBackend : browserBackend;

export type { BackendAdapter } from './types';
