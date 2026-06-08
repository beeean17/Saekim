import type { HTMLAttributes, ReactNode } from 'react';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Panel({ children, className = 'ui-panel', ...props }: PanelProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
