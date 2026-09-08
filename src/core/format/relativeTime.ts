import type { AppLanguage } from '../../i18n/messages';

export function relativeTime(timestamp?: number, language: AppLanguage = 'ko'): string {
  if (!timestamp) return '';

  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;

  if (diff < minute) return language === 'ko' ? '방금' : 'now';
  if (diff < hour) return `${Math.floor(diff / minute)}${language === 'ko' ? '분' : 'm'}`;
  if (diff < day) return `${Math.floor(diff / hour)}${language === 'ko' ? '시간' : 'h'}`;
  if (diff < day * 2) return language === 'ko' ? '어제' : 'yesterday';
  if (diff < week) return `${Math.floor(diff / day)}${language === 'ko' ? '일' : 'd'}`;
  return `${Math.floor(diff / week)}${language === 'ko' ? '주' : 'w'}`;
}
