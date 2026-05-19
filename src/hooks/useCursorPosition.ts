import { useEffect, useState } from 'react';

export interface CursorPosition {
  row: number;
  column: number;
}

export function useCursorPosition(text: string, textarea: HTMLTextAreaElement | null): CursorPosition {
  const [position, setPosition] = useState<CursorPosition>({ row: 1, column: 1 });

  useEffect(() => {
    if (!textarea) return;

    const update = () => {
      const beforeCursor = text.slice(0, textarea.selectionStart);
      const lines = beforeCursor.split('\n');
      const currentLine = lines[lines.length - 1] ?? '';
      setPosition({
        row: lines.length,
        column: currentLine.length + 1,
      });
    };

    update();
    textarea.addEventListener('click', update);
    textarea.addEventListener('keyup', update);
    textarea.addEventListener('select', update);
    return () => {
      textarea.removeEventListener('click', update);
      textarea.removeEventListener('keyup', update);
      textarea.removeEventListener('select', update);
    };
  }, [text, textarea]);

  return position;
}
