import { useEffect, useState, type RefObject } from 'react';

export interface CursorPosition {
  readonly row: number;
  readonly column: number;
}

type TextareaCursorTarget = RefObject<HTMLTextAreaElement> | HTMLTextAreaElement | null;

export function useCursorPosition(text: string, textareaTarget: TextareaCursorTarget): CursorPosition {
  const [position, setPosition] = useState<CursorPosition>({ row: 1, column: 1 });

  useEffect(() => {
    const textarea = resolveTextarea(textareaTarget);
    if (!textarea) return;

    const update = () => {
      const beforeCursor = textarea.value.slice(0, textarea.selectionStart);
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
    textarea.addEventListener('mouseup', update);
    textarea.addEventListener('select', update);
    return () => {
      textarea.removeEventListener('click', update);
      textarea.removeEventListener('keyup', update);
      textarea.removeEventListener('mouseup', update);
      textarea.removeEventListener('select', update);
    };
  }, [text, textareaTarget]);

  return position;
}

function resolveTextarea(target: TextareaCursorTarget): HTMLTextAreaElement | null {
  if (!target) return null;
  if (target instanceof HTMLTextAreaElement) return target;
  return target.current;
}
