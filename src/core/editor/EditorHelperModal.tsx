import { useEffect, useMemo, useRef, useState } from 'react';
import './editorHelper.css';
import type { EditorHelperContribution, EditorImageInsertMode } from '../../app/feature';
import type { EditorHelperItemBase } from './helperTypes';
import { Dialog } from '../../components/ui/overlay/Dialog';
import { CloseButton } from '../../components/ui/primitives/CloseButton';
import { SearchField } from '../../components/ui/primitives/SearchField';

export function EditorHelperModal({
  helper,
  onClose,
  onInsert,
  onImageInsert,
}: {
  helper: EditorHelperContribution;
  onClose: () => void;
  onInsert: (helper: EditorHelperContribution, item: EditorHelperItemBase) => void;
  onImageInsert?: (mode: EditorImageInsertMode) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const filteredItems = useMemo(() => searchHelperItems(helper, query), [helper, query]);
  const [selectedId, setSelectedId] = useState<string>(helper.items[0]?.id ?? '');
  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedId(filteredItems[0]?.id ?? '');
  }, [filteredItems]);

  return (
    <Dialog open title={helper.title} className="helper-modal" backdropClassName="helper-modal-backdrop" onClose={onClose}>
      <div className="helper-modal-head">
        <div>
          <h2>{helper.title}</h2>
          <p>{helper.description}</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <SearchField ref={inputRef} className="helper-search" value={query} placeholder={helper.placeholder} onChange={setQuery} />
      <div className="helper-modal-body">
        <div className="helper-results" role="listbox" aria-label={`${helper.title} 결과`}>
          {filteredItems.length === 0 ? (
            <div className="helper-empty">검색 결과 없음</div>
          ) : (
            filteredItems.map((item) => (
              <button
                className={item.id === selectedItem?.id ? 'selected' : ''}
                key={item.id}
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
        <div className="helper-preview">
          {selectedItem ? (
            <>
              <div className="helper-preview-head">
                <div>
                  <span>{selectedItem.title}</span>
                  <code>{helper.syntax(selectedItem)}</code>
                </div>
                <button type="button" onClick={() => onInsert(helper, selectedItem)}>
                  {helper.insertLabel?.(selectedItem) ?? '삽입'}
                </button>
              </div>
              {helper.renderPreview(selectedItem, { onImageInsert })}
            </>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

function searchHelperItems(helper: EditorHelperContribution, query: string): EditorHelperItemBase[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return helper.items;

  return helper.items.filter((item) => {
    const fields = [item.title, item.category, ...item.keywords, helper.syntax(item)];
    return fields.some((field) => field.toLowerCase().includes(needle));
  });
}
