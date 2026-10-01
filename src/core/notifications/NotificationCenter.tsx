import { useEffect } from 'react';
import './notifications.css';
import { Icon } from '../../components/primitives/Icon';
import { IconButton } from '../../components/ui/primitives/IconButton';
import { useI18n } from '../../i18n/useI18n';
import { useNotificationStore, type Notification } from './store';

export function NotificationCenter() {
  const { t } = useI18n();
  const notifications = useNotificationStore((state) => state.notifications);
  const dismiss = useNotificationStore((state) => state.dismiss);

  if (notifications.length === 0) return null;

  return (
    <div className="notification-center" aria-label={t('notify.region')} role="region">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => dismiss(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const { timeout } = notification;

  useEffect(() => {
    if (timeout === null) return;
    const handle = window.setTimeout(onDismiss, timeout);
    return () => window.clearTimeout(handle);
  }, [onDismiss, timeout]);

  return (
    <div
      className={`notification notification-${notification.tone}`}
      /* Errors interrupt; everything else waits for a pause in speech. */
      role={notification.tone === 'error' ? 'alert' : 'status'}
      aria-live={notification.tone === 'error' ? 'assertive' : 'polite'}
    >
      <Icon name={iconForTone(notification.tone)} />
      <div className="notification-copy">
        <span className="notification-message">{notification.message}</span>
        {notification.detail ? <span className="notification-detail">{notification.detail}</span> : null}
      </div>
      {notification.action ? (
        <button
          className="notification-action"
          type="button"
          onClick={() => {
            notification.action?.run();
            onDismiss();
          }}
        >
          {notification.action.label}
        </button>
      ) : null}
      <IconButton className="notification-dismiss" label={t('common.dismiss')} onClick={onDismiss}>
        <Icon name="close" />
      </IconButton>
    </div>
  );
}

function iconForTone(tone: Notification['tone']): 'info' | 'check' | 'alert' {
  if (tone === 'success') return 'check';
  if (tone === 'error' || tone === 'warning') return 'alert';
  return 'info';
}
