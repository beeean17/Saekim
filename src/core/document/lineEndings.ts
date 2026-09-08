export type LineEnding = 'LF' | 'CRLF';

export interface LineEndingInfo {
  eol: LineEnding;
  mixed: boolean;
}

export function detectLineEndings(content: string): LineEndingInfo {
  let crlfCount = 0;
  let lfCount = 0;

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== '\n') continue;
    if (index > 0 && content[index - 1] === '\r') crlfCount += 1;
    else lfCount += 1;
  }

  return {
    eol: crlfCount >= lfCount && crlfCount > 0 ? 'CRLF' : 'LF',
    mixed: crlfCount > 0 && lfCount > 0,
  };
}

export function serializeLineEndings(content: string, eol: LineEnding): string {
  const normalized = content.replace(/\r\n/g, '\n');
  return eol === 'CRLF' ? normalized.replace(/\n/g, '\r\n') : normalized;
}
