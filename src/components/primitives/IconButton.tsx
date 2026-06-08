import { IconButton as UiIconButton } from '../ui/primitives/IconButton';
import type { ComponentProps } from 'react';

type IconButtonProps = ComponentProps<typeof UiIconButton>;

export function IconButton({ className = 'icon-btn', ...props }: IconButtonProps) {
  return <UiIconButton className={className} {...props} />;
}
