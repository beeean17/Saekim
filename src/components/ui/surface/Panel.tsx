import type { HTMLAttributes, ReactNode } from 'react';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Panel({ children, className = 'ui-panel', ...props }: PanelProps) {
  const classes = className === 'ui-panel' ? className : `ui-panel ${className}`;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
