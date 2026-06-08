import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  label: string;
  className?: string;
}

export function IconButton({ children, label, className = 'ui-icon-button', ...props }: IconButtonProps) {
  return (
    <button className={className} title={label} aria-label={label} type="button" {...props}>
      {children}
    </button>
  );
}
