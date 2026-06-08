export function relativeTime(timestamp?: number): string {
  if (!timestamp) return '';

  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;

  if (diff < minute) return '방금';
  if (diff < hour) return `${Math.floor(diff / minute)}분`;
  if (diff < day) return `${Math.floor(diff / hour)}시간`;
  if (diff < day * 2) return '어제';
  if (diff < week) return `${Math.floor(diff / day)}일`;
  return `${Math.floor(diff / week)}주`;
}
