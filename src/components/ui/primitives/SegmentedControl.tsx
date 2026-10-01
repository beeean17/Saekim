import type { ReactNode } from 'react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Longer wording for the tooltip only. It never replaces the visible label. */
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
  const isTablist = optionRole === 'tab';

  /* Left/Right (and Home/End) move between segments, as both the tab and the
     radio-group patterns require. Without this the control is mouse-only. */
  const moveFocus = (index: number, delta: number | 'first' | 'last', container: HTMLElement | null) => {
    if (!container) return;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (buttons.length === 0) return;
    const nextIndex =
      delta === 'first'
        ? 0
        : delta === 'last'
          ? buttons.length - 1
          : (index + delta + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
    const nextValue = options[nextIndex]?.value;
    if (nextValue !== undefined) onChange(nextValue);
  };

  return (
    <div
      className={rootClassName}
      data-size={size}
      role={isTablist ? 'tablist' : 'group'}
      aria-label={ariaLabel}
    >
      {options.map((option, index) => {
        const active = value === option.value;
        return (
          <button
            className={active ? 'active' : ''}
            key={option.value}
            type="button"
            role={optionRole}
            /* Exactly one of these is set, so the current choice is always
               exposed to assistive tech rather than living only in a class. */
            aria-selected={isTablist ? active : undefined}
            aria-pressed={isTablist ? undefined : active}
            tabIndex={isTablist && !active ? -1 : undefined}
            title={option.title}
            onKeyDown={(event) => {
              const container = event.currentTarget.parentElement;
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                moveFocus(index, 1, container);
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                moveFocus(index, -1, container);
              } else if (event.key === 'Home') {
                event.preventDefault();
                moveFocus(index, 'first', container);
              } else if (event.key === 'End') {
                event.preventDefault();
                moveFocus(index, 'last', container);
              }
            }}
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
