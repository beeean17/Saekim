import type { ReactNode } from 'react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<SegmentedControlOption<T>>;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
  optionRole?: 'tab';
  onChange(value: T): void;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  ariaLabel,
  size = 'md',
  className,
  optionRole,
  onChange,
}: SegmentedControlProps<T>) {
  const rootClassName = className ? `ui-segmented ${className}` : 'ui-segmented';

  return (
    <div className={rootClassName} data-size={size} role={optionRole ? 'tablist' : undefined} aria-label={ariaLabel}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            className={active ? 'active' : ''}
            key={option.value}
            type="button"
            role={optionRole}
            aria-selected={optionRole ? active : undefined}
            title={option.title}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
