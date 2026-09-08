import { describe, expect, it } from 'vitest';
import { escapeRegExp, getLineIndentChange, replaceTextRange } from './textEditing';

function textarea(value: string, start: number, end = start): HTMLTextAreaElement {
  const element = document.createElement('textarea');
  element.value = value;
  element.selectionStart = start;
  element.selectionEnd = end;
  return element;
}

describe('text editing utilities', () => {
  it('indents every selected line and keeps the selection aligned', () => {
    const element = textarea('one\ntwo\nthree', 0, 7);

    expect(getLineIndentChange(element, false)).toEqual({
      value: '    one\n    two\nthree',
      selectionStart: 4,
      selectionEnd: 15,
    });
  });

  it('outdents mixed indentation without crossing line boundaries', () => {
    const element = textarea('    one\n  two', 0, 13);

    expect(getLineIndentChange(element, true)).toEqual({
      value: 'one\ntwo',
      selectionStart: 0,
      selectionEnd: 7,
    });
  });

  it('replaces a range and preserves a cursor after the replacement', () => {
    const element = textarea('hello world', 11);
    replaceTextRange(element, 6, 11, 'Saekim');

    expect(element.value).toBe('hello Saekim');
    expect(element.selectionStart).toBe(12);
    expect(element.selectionEnd).toBe(12);
  });

  it('escapes regular expression metacharacters', () => {
    expect(escapeRegExp('a+b? [c]')).toBe('a\\+b\\? \\[c\\]');
  });
});
