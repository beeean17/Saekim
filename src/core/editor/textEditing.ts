const tabIndent = '    ';

export interface LineIndentChange {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function insertHardLineBreak(textarea: HTMLTextAreaElement | null): void {
  insertTextAtSelection(textarea, '  \n');
}

export function indentSelectedLines(textarea: HTMLTextAreaElement | null, outdent: boolean): void {
  if (!textarea) return;

  const change = getLineIndentChange(textarea, outdent);
  setTextareaValue(textarea, change.value);
  textarea.selectionStart = change.selectionStart;
  textarea.selectionEnd = change.selectionEnd;
  dispatchTextareaInput(textarea);
  textarea.focus();
}

export function getLineIndentChange(textarea: HTMLTextAreaElement, outdent: boolean): LineIndentChange {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);

  if (outdent) return getLineOutdentChange(value, start, end);

  if (!selected.includes('\n')) {
    return {
      value: `${value.slice(0, start)}${tabIndent}${value.slice(end)}`,
      selectionStart: start + tabIndent.length,
      selectionEnd: start + tabIndent.length,
    };
  }

  const blockStart = value.lastIndexOf('\n', start - 1) + 1;
  const selectedEnd = Math.max(start, end - 1);
  const nextLineBreak = value.indexOf('\n', selectedEnd);
  const blockEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  const block = value.slice(blockStart, blockEnd);
  const lineCount = block.split('\n').length;
  const replacement = block.replace(/^/gm, tabIndent);
  return {
    value: `${value.slice(0, blockStart)}${replacement}${value.slice(blockEnd)}`,
    selectionStart: start + tabIndent.length,
    selectionEnd: end + tabIndent.length * lineCount,
  };
}

export function replaceTextRange(textarea: HTMLTextAreaElement, start: number, end: number, replacement: string): void {
  const value = textarea.value;
  const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const delta = replacement.length - (end - start);

  setTextareaValue(textarea, next);
  textarea.selectionStart = adjustSelectionIndex(selectionStart, start, end, delta);
  textarea.selectionEnd = adjustSelectionIndex(selectionEnd, start, end, delta);
  dispatchTextareaInput(textarea);
}

export function insertTextAtSelection(textarea: HTMLTextAreaElement | null, snippet: string): void {
  if (!textarea) return;
  const start = textarea.selectionStart;

  replaceSelectionUndoably(textarea, snippet);
  textarea.selectionStart = start + snippet.length;
  textarea.selectionEnd = start + snippet.length;
}

export function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (valueSetter) {
    valueSetter.call(textarea, value);
    return;
  }

  textarea.value = value;
}

export function dispatchTextareaInput(textarea: HTMLTextAreaElement): void {
  const event =
    typeof InputEvent === 'function'
      ? new InputEvent('input', { bubbles: true, inputType: 'insertText' })
      : new Event('input', { bubbles: true });

  textarea.dispatchEvent(event);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getLineOutdentChange(value: string, start: number, end: number): LineIndentChange {
  const blockStart = value.lastIndexOf('\n', start - 1) + 1;
  const selectedEnd = Math.max(start, end - 1);
  const nextLineBreak = value.indexOf('\n', selectedEnd);
  const blockEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  const block = value.slice(blockStart, blockEnd);
  let removedBeforeStart = 0;
  let removedBeforeEnd = 0;
  let position = blockStart;

  const replacement = block
    .split('\n')
    .map((line) => {
      const removeCount = line.startsWith(tabIndent) ? tabIndent.length : Math.min(line.match(/^ */)?.[0].length ?? 0, tabIndent.length);
      if (position < start) removedBeforeStart += Math.min(removeCount, Math.max(0, start - position));
      if (position < end) removedBeforeEnd += Math.min(removeCount, Math.max(0, end - position));
      position += line.length + 1;
      return line.slice(removeCount);
    })
    .join('\n');

  return {
    value: `${value.slice(0, blockStart)}${replacement}${value.slice(blockEnd)}`,
    selectionStart: Math.max(blockStart, start - removedBeforeStart),
    selectionEnd: Math.max(blockStart, end - removedBeforeEnd),
  };
}

function replaceSelectionUndoably(textarea: HTMLTextAreaElement, replacement: string): void {
  textarea.focus();

  try {
    if (document.execCommand('insertText', false, replacement)) {
      dispatchTextareaInput(textarea);
      return;
    }
  } catch {
    // Fallback below keeps non-browser test/runtime environments working.
  }

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  setTextareaValue(textarea, next);
  dispatchTextareaInput(textarea);
}

function adjustSelectionIndex(index: number, start: number, end: number, delta: number): number {
  if (index <= start) return index;
  if (index >= end) return index + delta;
  return start;
}
