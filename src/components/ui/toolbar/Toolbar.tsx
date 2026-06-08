import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Toolbar({ children, className = 'ui-toolbar', ...props }: ToolbarProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export function ToolbarGroup({ children, className = 'ui-toolbar-group', ...props }: ToolbarProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function ToolbarButton({ children, className = 'ui-toolbar-button', ...props }: ToolbarButtonProps) {
  return (
    <button className={className} type="button" {...props}>
      {children}
    </button>
  );
}
