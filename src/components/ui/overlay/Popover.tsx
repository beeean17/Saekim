import { useEffect, useRef, type ReactNode } from 'react';

interface PopoverProps {
  open: boolean;
  align?: 'start' | 'end';
  labelledBy?: string;
  ariaLabel?: string;
  className?: string;
  role?: 'dialog' | 'menu';
  children: ReactNode;
  onClose(): void;
}

export function Popover({
  open,
  align = 'end',
  labelledBy,
  ariaLabel,
  className = 'ui-popover',
  role = 'dialog',
  children,
  onClose,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && ref.current?.contains(target)) return;
      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('click', closeOnClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeOnClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className={className}
      data-align={align}
      ref={ref}
      role={role}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
