import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Toolbar({ children, className = 'ui-toolbar', ...props }: ToolbarProps) {
  const classes = className === 'ui-toolbar' ? className : `ui-toolbar ${className}`;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export function ToolbarGroup({ children, className = 'ui-toolbar-group', ...props }: ToolbarProps) {
  const classes = className === 'ui-toolbar-group' ? className : `ui-toolbar-group ${className}`;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function ToolbarButton({ children, className = 'ui-toolbar-button', ...props }: ToolbarButtonProps) {
  const classes = className === 'ui-toolbar-button' ? className : `ui-toolbar-button ${className}`;

  return (
    <button className={classes} type="button" {...props}>
      {children}
    </button>
  );
}
