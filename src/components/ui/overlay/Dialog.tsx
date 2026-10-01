import { useEffect, useRef, type ReactNode } from 'react';

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

/*
 * Escape must reach only the dialog on top. Every open dialog registers here,
 * so a confirmation opened from inside another dialog no longer dismisses both
 * of them with a single keypress.
 */
const dialogStack: symbol[] = [];

export function Dialog({
  open,
  title,
  className = 'ui-dialog',
  backdropClassName = 'ui-dialog-backdrop',
  closeOnBackdrop = true,
  onClose,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const identity = useRef<symbol>(Symbol('dialog'));
  const dialogClassName = className === 'ui-dialog' ? className : `ui-dialog ${className}`;
  const backdropClasses = backdropClassName === 'ui-dialog-backdrop' ? backdropClassName : `ui-dialog-backdrop ${backdropClassName}`;

  useEffect(() => {
    if (!open) return;
    const token = identity.current;
    dialogStack.push(token);

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      firstFocusableElement(dialogRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      const index = dialogStack.indexOf(token);
      if (index >= 0) dialogStack.splice(index, 1);
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className={backdropClasses}
      role="presentation"
      onMouseDown={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={dialogClassName}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function focusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'),
  ).filter((element) => !element.hidden);
}

function firstFocusableElement(root: HTMLElement | null): HTMLElement | undefined {
  return focusableElements(root)[0];
}

interface DialogActionsProps {
  children: ReactNode;
  className?: string;
}

export function DialogActions({ children, className = 'ui-dialog-actions' }: DialogActionsProps) {
  const classes = className === 'ui-dialog-actions' ? className : `ui-dialog-actions ${className}`;
  return <div className={classes}>{children}</div>;
}
