import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { FileTreeNode } from '../../types/workspace';
import { MenuSurface } from '../ui/surface/MenuSurface';
import { useI18n } from '../../i18n/useI18n';

export interface TreeMenuPosition {
  x: number;
  y: number;
}

export function TreeContextMenu({
  node,
  position,
  onRename,
  onCreateFile,
  onCreateFolder,
  onDuplicate,
  onTrash,
  onClose,
}: {
  node: FileTreeNode;
  position: TreeMenuPosition;
  onRename: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onDuplicate: () => void;
  onTrash: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const closeForOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      onClose();
    };
    const closeForViewportChange = () => onClose();
    window.addEventListener('pointerdown', closeForOutsidePointer);
    window.addEventListener('resize', closeForViewportChange);
    window.addEventListener('scroll', closeForViewportChange, true);
    return () => {
      window.removeEventListener('pointerdown', closeForOutsidePointer);
      window.removeEventListener('resize', closeForViewportChange);
      window.removeEventListener('scroll', closeForViewportChange, true);
    };
  }, [onClose]);

  const run = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <MenuSurface
      aria-label={t('sidebar.fileActions', { name: node.name })}
      className="tree-context-menu"
      onKeyDown={handleMenuKeyDown}
      ref={menuRef}
      role="menu"
      style={{ left: position.x, top: position.y }}
    >
      <button role="menuitem" type="button" onClick={() => run(onRename)}>{t('sidebar.rename')}</button>
      {node.type === 'folder' ? (
        <>
          <button role="menuitem" type="button" onClick={() => run(onCreateFile)}>{t('sidebar.createFile')}</button>
          <button role="menuitem" type="button" onClick={() => run(onCreateFolder)}>{t('sidebar.createFolder')}</button>
        </>
      ) : (
        <button role="menuitem" type="button" onClick={() => run(onDuplicate)}>{t('sidebar.duplicate')}</button>
      )}
      <div role="separator" />
      <button className="danger" role="menuitem" type="button" onClick={() => run(onTrash)}>{t('sidebar.moveToTrash')}</button>
    </MenuSurface>
  );
}

function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key === 'Escape') return;
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
  if (items.length === 0) return;
  event.preventDefault();
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? items.length - 1
      : event.key === 'ArrowDown'
        ? (current + 1 + items.length) % items.length
        : (current - 1 + items.length) % items.length;
  items[next]?.focus();
}
