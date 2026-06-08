import { useEffect, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  size?: 'md' | 'lg' | 'fullscreen-safe';
  className?: string;
  backdropClassName?: string;
  closeOnBackdrop?: boolean;
  onClose(): void;
  children: ReactNode;
}

export function Dialog({
  open,
  title,
  className = 'ui-dialog',
  backdropClassName = 'ui-dialog-backdrop',
  closeOnBackdrop = true,
  onClose,
  children,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className={backdropClassName}
      role="presentation"
      onMouseDown={closeOnBackdrop ? onClose : undefined}
    >
      <div className={className} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

interface DialogActionsProps {
  children: ReactNode;
  className?: string;
}

export function DialogActions({ children, className = 'ui-dialog-actions' }: DialogActionsProps) {
  return <div className={className}>{children}</div>;
}
