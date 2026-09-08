import { useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import './search.css';
import { Icon } from '../../components/primitives/Icon';
import { CloseButton } from '../../components/ui/primitives/CloseButton';
import { IconButton } from '../../components/ui/primitives/IconButton';
import { SearchField } from '../../components/ui/primitives/SearchField';
import { Backend } from '../../platform/common/backend';
import { useWorkspaceStore } from '../../store/workspace';
import type { OpenFile, WorkspaceSearchItem } from '../../types/workspace';

interface SearchOptions {
  caseSensitive: boolean;
  useRegex: boolean;
  wholeWord: boolean;
}

interface FindMatch {
  start: number;
  end: number;
  text: string;
  captures: string[];
  groups?: Record<string, string>;
}

export function FindBar({
  file,
  initialReplace,
  textareaRef,
  onClose,
}: {
  file: OpenFile;
  initialReplace: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const initialSelection = useRef(selectionRange(textareaRef.current, file.content.length));
  const rootPath = useWorkspaceStore((state) => state.rootPath);
  const updateContent = useWorkspaceStore((state) => state.updateContent);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(initialReplace);
  const [scope, setScope] = useState<'document' | 'workspace'>('document');
  const [selectionOnly, setSelectionOnly] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    useRegex: false,
    wholeWord: false,
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [workspaceResults, setWorkspaceResults] = useState<WorkspaceSearchItem[] | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const searchRange = selectionOnly ? initialSelection.current : { start: 0, end: file.content.length };
  const matchResult = useMemo(
    () => findMatches(file.content, query, options, searchRange),
    [file.content, options, query, searchRange.end, searchRange.start],
  );
  const matches = matchResult.matches;
  const hasSelection = initialSelection.current.end > initialSelection.current.start;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    setReplaceOpen(initialReplace);
  }, [initialReplace]);

  useEffect(() => {
    initialSelection.current = selectionRange(textareaRef.current, file.content.length);
    setSelectionOnly(false);
    setActiveIndex(0);
  }, [file.id, textareaRef]);

  useEffect(() => {
    setActiveIndex(0);
  }, [options, query, scope, selectionOnly]);

  useEffect(() => {
    if (scope !== 'document' || matches.length === 0) return;
    const match = matches[activeIndex % matches.length];
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);
    inputRef.current?.focus();
  }, [activeIndex, matches, scope, textareaRef]);

  useEffect(() => {
    if (scope !== 'workspace' || !query.trim() || !rootPath || rootPath.startsWith('~')) {
      setWorkspaceResults(scope === 'workspace' && query.trim() ? [] : null);
      setWorkspaceError(null);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const items: WorkspaceSearchItem[] = [];
          let cursor: string | null = null;
          do {
            const page = await Backend.folders.searchWorkspace({
              rootPath,
              query,
              scope: 'content',
              cursor,
              limit: 200,
              ...options,
            });
            if (cancelled) return;
            items.push(...page.items);
            const nextCursor = page.nextCursor ?? null;
            if (nextCursor === cursor) break;
            cursor = nextCursor;
          } while (cursor);
          if (!cancelled) {
            setWorkspaceResults(items);
            setWorkspaceError(null);
          }
        } catch (error) {
          if (!cancelled) {
            setWorkspaceResults([]);
            setWorkspaceError(error instanceof Error ? error.message : String(error));
          }
        }
      })();
    }, 200);
    setWorkspaceResults(null);
    setWorkspaceError(null);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [options, query, rootPath, scope]);

  const go = (direction: 1 | -1) => {
    if (matches.length === 0) return;
    setActiveIndex((index) => (index + direction + matches.length) % matches.length);
  };
  const replaceCurrent = () => {
    if (matches.length === 0) return;
    const match = matches[activeIndex % matches.length];
    const inserted = replacementForMatch(match, replacement, options.useRegex);
    const nextContent = `${file.content.slice(0, match.start)}${inserted}${file.content.slice(match.end)}`;
    updateContent(file.id, nextContent);
    selectEditorRange(textareaRef.current, match.start, match.start + inserted.length);
  };
  const replaceAll = () => {
    if (matches.length === 0) return;
    const nextContent = [...matches].reverse().reduce((content, match) => {
      const inserted = replacementForMatch(match, replacement, options.useRegex);
      return `${content.slice(0, match.start)}${inserted}${content.slice(match.end)}`;
    }, file.content);
    updateContent(file.id, nextContent);
  };

  return (
    <div className="find-panel">
      <div className="find-bar">
        <button
          aria-pressed={replaceOpen}
          className="find-expand"
          title="바꾸기 열기"
          type="button"
          onClick={() => setReplaceOpen((open) => !open)}
        >
          {replaceOpen ? '−' : '+'}
        </button>
        <div className="find-fields">
          <SearchField
            ref={inputRef}
            className="find-search-field"
            value={query}
            placeholder={scope === 'document' ? '현재 문서 찾기' : '워크스페이스 내용 찾기'}
            onChange={setQuery}
            onEscape={() => {
              onClose();
              textareaRef.current?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && scope === 'document') {
                event.preventDefault();
                go(event.shiftKey ? -1 : 1);
              }
            }}
          />
          {replaceOpen && scope === 'document' ? (
            <input
              aria-label="바꿀 내용"
              className="find-replace-field"
              placeholder="바꿀 내용"
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  replaceCurrent();
                }
              }}
            />
          ) : null}
        </div>
        <div className="find-options" aria-label="검색 옵션">
          <OptionButton active={options.caseSensitive} label="대소문자 구분" onClick={() => toggleOption('caseSensitive', setOptions)}>Aa</OptionButton>
          <OptionButton active={options.wholeWord} label="단어 단위" onClick={() => toggleOption('wholeWord', setOptions)}>W</OptionButton>
          <OptionButton active={options.useRegex} label="정규식" onClick={() => toggleOption('useRegex', setOptions)}>.*</OptionButton>
          <OptionButton
            active={selectionOnly}
            disabled={!hasSelection || scope === 'workspace'}
            label="선택 영역에서 찾기"
            onClick={() => setSelectionOnly((value) => !value)}
          >
            Sel
          </OptionButton>
        </div>
        <button
          aria-pressed={scope === 'workspace'}
          className="find-scope"
          disabled={!rootPath || rootPath.startsWith('~')}
          type="button"
          onClick={() => setScope((value) => (value === 'document' ? 'workspace' : 'document'))}
        >
          {scope === 'document' ? '문서' : '전체'}
        </button>
        {scope === 'document' ? (
          <>
            <span className="find-count">
              {matchResult.error ? '오류' : matches.length > 0 ? `${(activeIndex % matches.length) + 1}/${matches.length}` : query ? '0/0' : '-'}
            </span>
            <IconButton label="이전 결과" onClick={() => go(-1)}><Icon name="chevronUp" /></IconButton>
            <IconButton label="다음 결과" onClick={() => go(1)}><Icon name="chevronDown" /></IconButton>
            {replaceOpen ? <button className="find-action" type="button" onClick={replaceCurrent}>바꾸기</button> : null}
            {replaceOpen ? <button className="find-action" type="button" onClick={replaceAll}>전체</button> : null}
          </>
        ) : null}
        <CloseButton className="find-close" onClick={onClose}>닫기</CloseButton>
      </div>
      {matchResult.error && scope === 'document' ? <div className="find-error">{matchResult.error}</div> : null}
      {scope === 'workspace' ? (
        <WorkspaceContentResults
          error={workspaceError}
          items={workspaceResults}
          query={query}
          onOpen={async (item) => {
            await openFile(item.path);
            window.requestAnimationFrame(() => {
              const active = useWorkspaceStore.getState().openFiles.find((candidate) => candidate.path === item.path);
              if (!active) return;
              const result = findMatches(active.content, query, options, { start: 0, end: active.content.length });
              const match = result.matches[0];
              if (match) selectEditorRange(textareaRef.current, match.start, match.end);
            });
          }}
        />
      ) : null}
    </div>
  );
}

function OptionButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: string;
}) {
  return <button aria-label={label} aria-pressed={active} disabled={disabled} title={label} type="button" onClick={onClick}>{children}</button>;
}

function WorkspaceContentResults({
  error,
  items,
  query,
  onOpen,
}: {
  error: string | null;
  items: WorkspaceSearchItem[] | null;
  query: string;
  onOpen: (item: WorkspaceSearchItem) => void;
}) {
  if (!query.trim()) return null;
  if (error) return <div className="find-workspace-message" title={error}>검색할 수 없습니다.</div>;
  if (!items) return <div className="find-workspace-message">검색 중…</div>;
  if (items.length === 0) return <div className="find-workspace-message">일치하는 파일이 없습니다.</div>;
  return (
    <div className="find-workspace-results" role="listbox" aria-label="워크스페이스 검색 결과">
      {items.map((item) => (
        <button key={item.path} role="option" type="button" onClick={() => onOpen(item)}>
          <span className="find-workspace-file">{item.relativePath}</span>
          <span className="find-workspace-location">{item.matchLine}:{item.matchColumn} · {item.matchCount}개</span>
          <span className="find-workspace-preview">{item.matchPreview}</span>
        </button>
      ))}
    </div>
  );
}

function toggleOption(key: keyof SearchOptions, setOptions: Dispatch<SetStateAction<SearchOptions>>): void {
  setOptions((options) => ({ ...options, [key]: !options[key] }));
}

function selectionRange(textarea: HTMLTextAreaElement | null, contentLength: number): { start: number; end: number } {
  if (!textarea) return { start: 0, end: 0 };
  return {
    start: Math.max(0, Math.min(textarea.selectionStart, contentLength)),
    end: Math.max(0, Math.min(textarea.selectionEnd, contentLength)),
  };
}

export function findMatches(
  content: string,
  query: string,
  options: SearchOptions,
  range: { start: number; end: number } = { start: 0, end: content.length },
): { matches: FindMatch[]; error: string | null } {
  if (!query) return { matches: [], error: null };
  let matcher: RegExp;
  try {
    const pattern = options.useRegex ? query : escapeRegularExpression(query);
    matcher = new RegExp(pattern, `gm${options.caseSensitive ? '' : 'i'}`);
  } catch (error) {
    return { matches: [], error: error instanceof Error ? error.message : String(error) };
  }

  const matches = Array.from(content.matchAll(matcher))
    .map<FindMatch>((match) => ({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      text: match[0],
      captures: match.slice(1).map((capture) => capture ?? ''),
      groups: match.groups,
    }))
    .filter((match) => match.start >= range.start && match.end <= range.end)
    .filter((match) => !options.wholeWord || (isWordBoundary(content[match.start - 1]) && isWordBoundary(content[match.end])));
  return { matches, error: null };
}

function replacementForMatch(match: FindMatch, replacement: string, useRegex: boolean): string {
  if (!useRegex) return replacement;
  return replacement.replace(/\$(\$|&|\d{1,2}|<[^>]+>)/g, (token, reference: string) => {
    if (reference === '$') return '$';
    if (reference === '&') return match.text;
    if (reference.startsWith('<')) return match.groups?.[reference.slice(1, -1)] ?? '';
    const capture = Number(reference);
    return capture > 0 ? match.captures[capture - 1] ?? '' : token;
  });
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWordBoundary(character: string | undefined): boolean {
  return !character || !/[\p{L}\p{N}_]/u.test(character);
}

function selectEditorRange(textarea: HTMLTextAreaElement | null, start: number, end: number): void {
  window.requestAnimationFrame(() => {
    textarea?.focus();
    textarea?.setSelectionRange(start, end);
  });
}
