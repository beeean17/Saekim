import { describe, expect, it } from 'vitest';
import { isTextFieldOutsideEditor } from './textFieldFocus';

function input(type: string): HTMLInputElement {
  const element = document.createElement('input');
  element.type = type;
  return element;
}

describe('isTextFieldOutsideEditor', () => {
  it('claims the document editor for the app', () => {
    const editor = document.createElement('textarea');
    editor.setAttribute('data-document-editor', '');
    expect(isTextFieldOutsideEditor(editor)).toBe(false);
  });

  it('leaves every other text field to the platform', () => {
    expect(isTextFieldOutsideEditor(document.createElement('textarea'))).toBe(true);
    expect(isTextFieldOutsideEditor(document.createElement('input'))).toBe(true);
    expect(isTextFieldOutsideEditor(input('search'))).toBe(true);
  });

  it('ignores controls that have no text to undo', () => {
    expect(isTextFieldOutsideEditor(input('checkbox'))).toBe(false);
    expect(isTextFieldOutsideEditor(document.createElement('button'))).toBe(false);
    expect(isTextFieldOutsideEditor(document.body)).toBe(false);
    expect(isTextFieldOutsideEditor(null)).toBe(false);
  });
});
