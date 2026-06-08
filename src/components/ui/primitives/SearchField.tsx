import { forwardRef, type KeyboardEventHandler } from 'react';
import { Icon } from '../../primitives/Icon';

interface SearchFieldProps {
  value: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onChange(value: string): void;
  onEscape?(): void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, placeholder, autoFocus, className = 'ui-search-field', onChange, onEscape, onKeyDown },
  ref,
) {
  return (
    <div className={className}>
      <Icon name="search" />
      <input
        ref={ref}
        autoFocus={autoFocus}
        value={value}
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
