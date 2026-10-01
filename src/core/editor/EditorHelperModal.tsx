import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import './editorHelper.css';
import type { EditorHelperContribution, EditorImageInsertMode } from '../../app/feature';
import type { EditorHelperItemBase } from './helperTypes';
import { Dialog } from '../../components/ui/overlay/Dialog';
import { CloseButton } from '../../components/ui/primitives/CloseButton';
import { SearchField } from '../../components/ui/primitives/SearchField';
import { useI18n } from '../../i18n/useI18n';

export function EditorHelperModal({
  helper,
  showPreview = true,
  onClose,
  onInsert,
  onImageInsert,
}: {
  helper: EditorHelperContribution;
  showPreview?: boolean;
  onClose: () => void;
  onInsert: (helper: EditorHelperContribution, item: EditorHelperItemBase) => void;
  onImageInsert?: (mode: EditorImageInsertMode) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const filteredItems = useMemo(() => searchHelperItems(helper, query), [helper, query]);
  const [selectedId, setSelectedId] = useState<string>(helper.items[0]?.id ?? '');
  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const insertLabel = selectedItem ? helper.insertLabel?.(selectedItem) ?? t('common.insert') : t('common.insert');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedId(filteredItems[0]?.id ?? '');
  }, [filteredItems]);

  useEffect(() => {
    if (!selectedItem) return;
    listRef.current?.querySelector<HTMLElement>(`[data-item-id="${cssEscape(selectedItem.id)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedItem]);

  const step = (delta: number) => {
    if (filteredItems.length === 0) return;
    const index = filteredItems.findIndex((item) => item.id === selectedItem?.id);
    const nextIndex = Math.min(filteredItems.length - 1, Math.max(0, (index < 0 ? 0 : index) + delta));
    setSelectedId(filteredItems[nextIndex].id);
  };

  /* The list is driven from the search box so the user never has to leave it:
     arrows move the selection, Enter inserts. Double-click still works, but it
     is no longer the only way in. */
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      if (filteredItems[0]) setSelectedId(filteredItems[0].id);
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = filteredItems[filteredItems.length - 1];
      if (last) setSelectedId(last.id);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedItem) onInsert(helper, selectedItem);
    }
  };

  return (
    <Dialog open title={helper.title} className="helper-modal" backdropClassName="helper-modal-backdrop" onClose={onClose}>
      <div className="helper-modal-head">
        <div>
          <h2>{helper.title}</h2>
          <p>{helper.description}</p>
        </div>
        <CloseButton label={t('common.close')} onClick={onClose} />
      </div>
      <SearchField
        ref={inputRef}
        className="helper-search"
        label={helper.placeholder}
        value={query}
        placeholder={helper.placeholder}
        controls="helper-results"
        activeDescendant={selectedItem ? `helper-item-${selectedItem.id}` : undefined}
        onChange={setQuery}
        onKeyDown={onSearchKeyDown}
      />
      <p className="helper-hint">{t('helper.keyboardHint', { action: insertLabel })}</p>
      <div className={`helper-modal-body ${showPreview ? '' : 'helper-modal-body-single'}`.trim()}>
        <div
          className="helper-results"
          id="helper-results"
          ref={listRef}
          role="listbox"
          aria-label={t('helper.results', { title: helper.title })}
        >
          {filteredItems.length === 0 ? (
            <div className="helper-empty">{t('helper.empty')}</div>
          ) : (
            filteredItems.map((item) => (
              <button
                aria-selected={item.id === selectedItem?.id}
                className={item.id === selectedItem?.id ? 'selected' : ''}
                data-item-id={item.id}
                id={`helper-item-${item.id}`}
                key={item.id}
                role="option"
                tabIndex={-1}
                type="button"
                onClick={() => setSelectedId(item.id)}
                onDoubleClick={() => onInsert(helper, item)}
              >
                <span className="helper-result-title">{item.title}</span>
                <span className="helper-result-category">{item.category}</span>
                <code>{helper.syntax(item)}</code>
              </button>
            ))
          )}
        </div>
        {showPreview ? (
          <div className="helper-preview">
            {selectedItem ? (
              <>
                <div className="helper-preview-head">
                  <div>
                    <span>{selectedItem.title}</span>
                    <code>{helper.syntax(selectedItem)}</code>
                  </div>
                  <button type="button" onClick={() => onInsert(helper, selectedItem)}>
                    {insertLabel}
                  </button>
                </div>
                {helper.renderPreview(selectedItem, { onImageInsert })}
              </>
            ) : null}
          </div>
        ) : selectedItem ? (
          <div className="helper-single-action">
            <code>{helper.syntax(selectedItem)}</code>
            <button type="button" onClick={() => onInsert(helper, selectedItem)}>
              {insertLabel}
            </button>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

function searchHelperItems(helper: EditorHelperContribution, query: string): EditorHelperItemBase[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return helper.items;

  return helper.items.filter((item) => {
    const fields = [item.title, item.category, ...item.keywords, helper.syntax(item)];
    return fields.some((field) => field.toLowerCase().includes(needle));
  });
}
