export function countKoreanAwareWords(text: string): number {
  const latinWords = text.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const koreanChars = text.match(/[가-힣]/g)?.length ?? 0;
  return latinWords + Math.ceil(koreanChars / 2);
}

export function readingTime(text: string): string {
  const chars = text.replace(/\s+/g, '').length;
  return `~${Math.max(1, Math.ceil(chars / 500))}분 읽기`;
}
