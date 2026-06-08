import type { HTMLAttributes, ReactNode } from 'react';

interface MenuSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function MenuSurface({ children, className = 'ui-menu-surface', ...props }: MenuSurfaceProps) {
  const classes = className === 'ui-menu-surface' ? className : `ui-menu-surface ${className}`;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
