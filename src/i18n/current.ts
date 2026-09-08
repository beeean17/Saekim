import { useSettingsStore } from '../store/settings';
import { translate, type TranslationKey, type TranslationValues } from './messages';

export function translateCurrent(key: TranslationKey, values?: TranslationValues): string {
  return translate(useSettingsStore.getState().language, key, values);
}
