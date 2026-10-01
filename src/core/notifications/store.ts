import { create } from 'zustand';

export type NotificationTone = 'info' | 'success' | 'warning' | 'error';

export interface NotificationAction {
  label: string;
  run(): void;
}

export interface Notification {
  id: string;
  tone: NotificationTone;
  message: string;
  detail?: string;
  action?: NotificationAction;
  /** Milliseconds before auto-dismiss; errors stay until dismissed. */
  timeout: number | null;
}

export interface NotifyOptions {
  tone?: NotificationTone;
  detail?: string;
  action?: NotificationAction;
  timeout?: number | null;
  /**
   * Replaces any earlier notification with the same key instead of stacking.
   * Use it for repeated status from one operation (export progress, autosave).
   */
  key?: string;
}

interface NotificationState {
  notifications: Notification[];
  push(message: string, options?: NotifyOptions): string;
  dismiss(id: string): void;
  clear(): void;
}

const defaultTimeouts: Record<NotificationTone, number | null> = {
  info: 4000,
  success: 3000,
  warning: 7000,
  /* Errors never time out. Losing the only report of a failure is how the app
     used to "fail silently" - the user has to acknowledge it. */
  error: null,
};

let sequence = 0;

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  push: (message, options = {}) => {
    const tone = options.tone ?? 'info';
    const id = options.key ?? `notification-${(sequence += 1)}`;
    const notification: Notification = {
      id,
      tone,
      message,
      detail: options.detail,
      action: options.action,
      timeout: options.timeout === undefined ? defaultTimeouts[tone] : options.timeout,
    };

    set((state) => {
      const existing = state.notifications.findIndex((candidate) => candidate.id === id);
      if (existing >= 0) {
        const next = state.notifications.slice();
        next[existing] = notification;
        return { notifications: next };
      }
      /* Keep the stack short; the oldest informational item gives way first. */
      const trimmed = state.notifications.length >= 4 ? state.notifications.slice(1) : state.notifications;
      return { notifications: [...trimmed, notification] };
    });

    return id;
  },
  dismiss: (id) =>
    set((state) => ({ notifications: state.notifications.filter((candidate) => candidate.id !== id) })),
  clear: () => set({ notifications: [] }),
}));

/** Imperative entry point for code outside React (stores, backends, handlers). */
export function notify(message: string, options?: NotifyOptions): string {
  return useNotificationStore.getState().push(message, options);
}

export function notifyError(message: string, error?: unknown, options?: NotifyOptions): string {
  return notify(message, { ...options, tone: 'error', detail: options?.detail ?? errorDetail(error) });
}

export function dismissNotification(id: string): void {
  useNotificationStore.getState().dismiss(id);
}

function errorDetail(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;
  if (error instanceof Error) return error.message;
  const text = String(error);
  return text && text !== '[object Object]' ? text : undefined;
}
