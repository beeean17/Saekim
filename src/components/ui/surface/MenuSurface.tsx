import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

interface MenuSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const MenuSurface = forwardRef<HTMLDivElement, MenuSurfaceProps>(function MenuSurface(
  { children, className = 'ui-menu-surface', ...props },
  ref,
) {
  const classes = className === 'ui-menu-surface' ? className : `ui-menu-surface ${className}`;

  return (
    <div className={classes} ref={ref} {...props}>
      {children}
    </div>
  );
});
