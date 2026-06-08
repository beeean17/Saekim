import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  role?: 'status' | 'note';
  className?: string;
}

export function EmptyState({ title, description, role = 'status', className = 'ui-empty-state' }: EmptyStateProps) {
  return (
    <div className={className} role={role}>
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
    </div>
  );
}
