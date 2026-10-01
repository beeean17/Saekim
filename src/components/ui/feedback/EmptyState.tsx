import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons that get the user out of the empty state. */
  actions?: ReactNode;
  role?: 'status' | 'note' | 'presentation';
  className?: string;
}

export function EmptyState({
  title,
  description,
  actions,
  role = 'status',
  className = 'ui-empty-state',
}: EmptyStateProps) {
  return (
    <div className={className} role={role}>
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {actions ? <div className="ui-empty-state-actions">{actions}</div> : null}
    </div>
  );
}
