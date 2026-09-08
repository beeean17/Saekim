import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useI18n } from '../../../i18n/useI18n';

interface CloseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  children?: ReactNode;
}

export function CloseButton({ label, children = '×', className = 'ui-close-button', ...props }: CloseButtonProps) {
  const { t } = useI18n();
  const classes = className === 'ui-close-button' ? className : `ui-close-button ${className}`;
  const accessibleLabel = label ?? t('common.close');

  return (
    <button className={classes} type="button" aria-label={accessibleLabel} title={accessibleLabel} {...props}>
      {children}
    </button>
  );
}
