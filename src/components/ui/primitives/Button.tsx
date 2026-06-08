import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'ghost' | 'surface' | 'primary';
  size?: 'sm' | 'md';
}

export function Button({ children, className, variant = 'ghost', size = 'md', ...props }: ButtonProps) {
  const classes = ['ui-button', `ui-button-${variant}`, `ui-button-${size}`, className].filter(Boolean).join(' ');
  return (
    <button className={classes} type="button" {...props}>
      {children}
    </button>
  );
}
