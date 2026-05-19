import { invokeCommand, isTauriRuntime } from './invoke';
import type { ThemeName } from '../../types/workspace';

export async function getNativeTheme(): Promise<ThemeName | null> {
  if (!isTauriRuntime()) return null;
  return invokeCommand<ThemeName | null>('get_theme');
}

export async function setNativeTheme(theme: ThemeName): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeCommand<null>('set_theme', { theme });
}
