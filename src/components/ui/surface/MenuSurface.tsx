import type { HTMLAttributes, ReactNode } from 'react';

interface MenuSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function MenuSurface({ children, className = 'ui-menu-surface', ...props }: MenuSurfaceProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
