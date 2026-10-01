import { useEffect, useMemo, useRef, useState } from 'react';
import { dispatchCommand, formatShortcut, type CommandRegistry } from '../../app/commands';
import type { AppOverlayProps, CommandContribution } from '../../app/feature';
import { Dialog } from '../../components/ui/overlay/Dialog';
import { SearchField } from '../../components/ui/primitives/SearchField';
import { useCommandPaletteStore } from './store';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/messages';

const MAX_RESULTS = 50;

export function CommandPalette({ commandRegistry }: AppOverlayProps) {
  const { t } = useI18n();
  const isOpen = useCommandPaletteStore((state) => state.isOpen);
  const close = useCommandPaletteStore((state) => state.close);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const commands = useMemo(() => filterCommands(commandRegistry, query), [commandRegistry, query]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, commands.length - 1)));
  }, [commands.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-command-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const run = (command: CommandContribution) => {
    if (command.isEnabled?.() === false) return;
    close();
    window.requestAnimationFrame(() => dispatchCommand(commandRegistry as CommandRegistry, command.id));
  };

  return (
    <Dialog
      backdropClassName="command-palette-backdrop"
      className="command-palette"
      open={isOpen}
      title={t('commandPalette.title')}
      onClose={close}
    >
      <SearchField
        autoFocus
        className="command-palette-search"
        label={t('commandPalette.placeholder')}
        controls="command-palette-list"
        activeDescendant={commands[activeIndex] ? `command-option-${activeIndex}` : undefined}
        placeholder={t('commandPalette.placeholder')}
        value={query}
        onChange={setQuery}
        onEscape={close}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, commands.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => Math.max(0, current - 1));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            const command = commands[activeIndex];
            if (command) run(command);
          }
        }}
      />
      <div
        className="command-palette-list"
        id="command-palette-list"
        ref={listRef}
        role="listbox"
        aria-label={t('commandPalette.commands')}
      >
        {commands.length > 0 ? (
          commands.map((command, index) => {
            const disabled = command.isEnabled?.() === false;
            return (
              <button
                aria-disabled={disabled}
                aria-selected={index === activeIndex}
                className="command-palette-item"
                data-command-index={index}
                disabled={disabled}
                id={`command-option-${index}`}
                key={command.id}
                role="option"
                tabIndex={-1}
                type="button"
                onClick={() => run(command)}
                onMouseMove={() => setActiveIndex(index)}
              >
                <span className="command-palette-copy">
                  <span className="command-palette-label">{command.label}</span>
                  {sectionLabelKey(command.menu?.section) ? (
                    <span className="command-palette-section">{t(sectionLabelKey(command.menu?.section)!)}</span>
                  ) : null}
                </span>
                {command.defaultShortcut ? <kbd>{formatShortcut(command.defaultShortcut)}</kbd> : null}
              </button>
            );
          })
        ) : (
          <p className="command-palette-empty">{t('commandPalette.empty')}</p>
        )}
      </div>
    </Dialog>
  );
}

/* Commands carry a developer-facing id; users get the menu the command lives
   in instead, which is the part they can actually recognise. */
function sectionLabelKey(section: string | undefined): TranslationKey | null {
  switch (section) {
    case 'file':
      return 'menu.file';
    case 'edit':
      return 'menu.edit';
    case 'view':
      return 'menu.view';
    case 'window':
      return 'menu.window';
    default:
      return null;
  }
}

function filterCommands(registry: AppOverlayProps['commandRegistry'], query: string): CommandContribution[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const scored = Array.from(registry.values())
    .map((command) => ({ command, score: scoreCommand(command, terms) }))
    .filter((entry) => entry.score > 0);

  /* Rank by how well the visible label matches, then alphabetically, so typing
     "save" puts Save first instead of whatever sorts earliest. */
  scored.sort((left, right) =>
    right.score - left.score || left.command.label.localeCompare(right.command.label),
  );

  return scored.slice(0, MAX_RESULTS).map((entry) => entry.command);
}

function scoreCommand(command: CommandContribution, terms: string[]): number {
  const label = command.label.toLocaleLowerCase();
  const haystack = [command.label, command.id, ...(command.keywords ?? [])].join(' ').toLocaleLowerCase();
  if (terms.length === 0) return command.isEnabled?.() === false ? 1 : 2;
  if (!terms.every((term) => haystack.includes(term))) return 0;

  let score = 1;
  for (const term of terms) {
    if (label.startsWith(term)) score += 4;
    else if (label.includes(term)) score += 2;
  }
  if (command.isEnabled?.() === false) score -= 1;
  return Math.max(1, score);
}
