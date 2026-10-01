import { describe, expect, it } from 'vitest';
import { shouldShowHelperPreview } from './EditorPane';

describe('Android editor helper layout', () => {
  it('removes the rendered KaTeX and Mermaid previews on Android', () => {
    expect(shouldShowHelperPreview('katex', true)).toBe(false);
    expect(shouldShowHelperPreview('mermaid', true)).toBe(false);
  });

  it('keeps other helpers and non-Android previews available', () => {
    expect(shouldShowHelperPreview('markdown', true)).toBe(true);
    expect(shouldShowHelperPreview('katex', false)).toBe(true);
    expect(shouldShowHelperPreview('mermaid', false)).toBe(true);
  });
});
