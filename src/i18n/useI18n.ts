import { useCallback } from 'react';
import { useSettingsStore } from '../store/settings';
import { translate, type TranslationKey, type TranslationValues } from './messages';

export function useI18n() {
  const language = useSettingsStore((state) => state.language);
  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues) => translate(language, key, values),
    [language],
  );
  return { language, t } as const;
}
