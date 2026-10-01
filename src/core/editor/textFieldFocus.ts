/**
 * Undo and redo belong to whichever text field has focus. The document editor
 * keeps its own history (see editHistory), but every other field - a rename
 * box, the find bar, the command palette - relies on the platform's native
 * undo. Routing Cmd+Z from those fields to the document rewound text the user
 * was not looking at, and on a just-created empty file sent it to the trash.
 *
 * The editor's textarea carries `data-document-editor`; it is the one text
 * field whose undo the app owns.
 */

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number']);

export function isTextFieldOutsideEditor(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.hasAttribute('data-document-editor')) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type);
  return target.isContentEditable === true;
}
