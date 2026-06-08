import { isTauriRuntime } from '../../lib/tauri/invoke';
import { browserBackend } from '../browser/browserBackend';
import { tauriDesktopBackend } from '../desktop/tauriDesktopBackend';
import type { BackendAdapter } from './BackendAdapter';

export const Backend: BackendAdapter = isTauriRuntime() ? tauriDesktopBackend : browserBackend;

export type { BackendAdapter } from './BackendAdapter';
