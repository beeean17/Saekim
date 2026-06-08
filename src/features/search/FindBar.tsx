import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import './search.css';
import { Icon } from '../../components/primitives/Icon';
import { CloseButton } from '../../components/ui/primitives/CloseButton';
import { IconButton } from '../../components/ui/primitives/IconButton';
import { SearchField } from '../../components/ui/primitives/SearchField';

export function FindBar({
  content,
  textareaRef,
  onClose,
}: {
  content: string;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = useMemo(() => findMatches(content, query), [content, query]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (matches.length === 0) return;
    const match = matches[activeIndex % matches.length];
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);
    inputRef.current?.focus();
  }, [activeIndex, matches, textareaRef]);

  const go = (direction: 1 | -1) => {
    if (matches.length === 0) return;
    setActiveIndex((index) => (index + direction + matches.length) % matches.length);
  };

  return (
    <div className="find-bar">
      <SearchField
        ref={inputRef}
        className="find-search-field"
        value={query}
        placeholder="현재 문서 찾기"
        onChange={setQuery}
        onEscape={() => {
          onClose();
          textareaRef.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            go(event.shiftKey ? -1 : 1);
          }
        }}
      />
      <span className="find-count">
        {matches.length > 0 ? `${(activeIndex % matches.length) + 1}/${matches.length}` : query ? '0/0' : '-'}
      </span>
      <IconButton label="이전 결과" onClick={() => go(-1)}>
        <Icon name="chevronUp" />
      </IconButton>
      <IconButton label="다음 결과" onClick={() => go(1)}>
        <Icon name="chevronDown" />
      </IconButton>
      <CloseButton className="find-close" onClick={onClose}>
        닫기
      </CloseButton>
    </div>
  );
}

function findMatches(content: string, query: string): Array<{ start: number; end: number }> {
  const needle = query.trim();
  if (!needle) return [];

  const matches: Array<{ start: number; end: number }> = [];
  const haystack = content.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let index = haystack.indexOf(lowerNeedle);

  while (index !== -1) {
    matches.push({ start: index, end: index + lowerNeedle.length });
    index = haystack.indexOf(lowerNeedle, index + lowerNeedle.length);
  }

  return matches;
}
