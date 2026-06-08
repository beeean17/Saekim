import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  label: string;
  className?: string;
}

export function IconButton({ children, label, className = 'ui-icon-button', ...props }: IconButtonProps) {
  const classes = className === 'ui-icon-button' ? className : `ui-icon-button ${className}`;

  return (
    <button className={classes} title={label} aria-label={label} type="button" {...props}>
      {children}
    </button>
  );
}
