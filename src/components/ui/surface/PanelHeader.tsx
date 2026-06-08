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
  const classes = className === 'ui-panel-header' ? className : `ui-panel-header ${className}`;
  const titleClasses = titleClassName === 'ui-panel-title' ? titleClassName : `ui-panel-title ${titleClassName}`;
  const descriptionClasses =
    descriptionClassName === 'ui-panel-description' ? descriptionClassName : `ui-panel-description ${descriptionClassName}`;

  return (
    <div className={classes}>
      <div>
        <div className={titleClasses}>{title}</div>
        {description ? <div className={descriptionClasses}>{description}</div> : null}
      </div>
      {actions}
    </div>
  );
}
