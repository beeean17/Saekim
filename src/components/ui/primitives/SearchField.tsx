import { forwardRef, type KeyboardEventHandler } from 'react';
import { Icon } from '../../primitives/Icon';

interface SearchFieldProps {
  value: string;
  /**
   * Accessible name. A placeholder is not a label: it disappears as soon as the
   * user types, and screen readers are not required to announce it.
   */
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Wires the input to a listbox it controls, for combobox-style pickers. */
  controls?: string;
  activeDescendant?: string;
  onChange(value: string): void;
  onEscape?(): void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    value,
    label,
    placeholder,
    autoFocus,
    className = 'ui-search-field',
    controls,
    activeDescendant,
    onChange,
    onEscape,
    onKeyDown,
  },
  ref,
) {
  const classes = className === 'ui-search-field' ? className : `ui-search-field ${className}`;

  return (
    <div className={classes}>
      <Icon name="search" />
      <input
        ref={ref}
        type="text"
        autoFocus={autoFocus}
        value={value}
        aria-label={label}
        aria-controls={controls}
        aria-activedescendant={activeDescendant}
        aria-autocomplete={controls ? 'list' : undefined}
        role={controls ? 'combobox' : undefined}
        aria-expanded={controls ? true : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onEscape?.();
          onKeyDown?.(event);
        }}
      />
    </div>
  );
});
