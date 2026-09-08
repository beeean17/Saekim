import { useEffect, useMemo, useRef, useState } from 'react';
import { dispatchCommand, formatShortcut, type CommandRegistry } from '../../app/commands';
import type { AppOverlayProps, CommandContribution } from '../../app/feature';
import { Dialog } from '../../components/ui/overlay/Dialog';
import { SearchField } from '../../components/ui/primitives/SearchField';
import { useCommandPaletteStore } from './store';
import { useI18n } from '../../i18n/useI18n';

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
      <div className="command-palette-list" ref={listRef} role="listbox" aria-label={t('commandPalette.commands')}>
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
                key={command.id}
                role="option"
                type="button"
                onClick={() => run(command)}
                onMouseMove={() => setActiveIndex(index)}
              >
                <span className="command-palette-copy">
                  <span className="command-palette-label">{command.label}</span>
                  <span className="command-palette-id">{command.id}</span>
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

function filterCommands(registry: AppOverlayProps['commandRegistry'], query: string): CommandContribution[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return Array.from(registry.values())
    .filter((command) => {
      const haystack = [command.label, command.id, ...(command.keywords ?? [])].join(' ').toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(0, MAX_RESULTS);
}
