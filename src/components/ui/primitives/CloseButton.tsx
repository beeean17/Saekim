import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface CloseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  children?: ReactNode;
}

export function CloseButton({ label = '닫기', children = '×', className = 'ui-close-button', ...props }: CloseButtonProps) {
  const classes = className === 'ui-close-button' ? className : `ui-close-button ${className}`;

  return (
    <button className={classes} type="button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
