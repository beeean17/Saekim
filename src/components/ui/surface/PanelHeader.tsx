import type { ReactNode } from 'react';

interface PanelHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function PanelHeader({
  title,
  description,
  actions,
  className = 'ui-panel-header',
  titleClassName = 'ui-panel-title',
  descriptionClassName = 'ui-panel-description',
}: PanelHeaderProps) {
  return (
    <div className={className}>
      <div>
        <div className={titleClassName}>{title}</div>
        {description ? <div className={descriptionClassName}>{description}</div> : null}
      </div>
      {actions}
    </div>
  );
}
