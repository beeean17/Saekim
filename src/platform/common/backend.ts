import type { BackendAdapter } from './BackendAdapter';
import { Platform } from './platform';

export const Backend: BackendAdapter = Platform.backend;

export type { BackendAdapter } from './BackendAdapter';
