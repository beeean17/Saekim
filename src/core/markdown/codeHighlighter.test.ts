import { describe, expect, it } from 'vitest';
import { PLAIN_LANGUAGE, highlightCodeToHtml, resolveLanguage } from './codeHighlighter';

describe('resolveLanguage', () => {
  it('keeps bundled grammars as-is', () => {
    expect(resolveLanguage('typescript')).toBe('typescript');
    expect(resolveLanguage('rust')).toBe('rust');
  });

  it('resolves aliases to their canonical grammar', () => {
    expect(resolveLanguage('ts')).toBe('typescript');
    expect(resolveLanguage('bash')).toBe('shellscript');
    expect(resolveLanguage('yml')).toBe('yaml');
    expect(resolveLanguage('c++')).toBe('cpp');
  });

  it('normalizes casing and surrounding whitespace', () => {
    expect(resolveLanguage('  TypeScript ')).toBe('typescript');
    expect(resolveLanguage('PY')).toBe('python');
  });

  it('falls back to plaintext for unbundled or empty languages', () => {
    expect(resolveLanguage('brainfuck')).toBe(PLAIN_LANGUAGE);
    expect(resolveLanguage('')).toBe(PLAIN_LANGUAGE);
    expect(resolveLanguage(null)).toBe(PLAIN_LANGUAGE);
    expect(resolveLanguage('text')).toBe(PLAIN_LANGUAGE);
  });
});

describe('highlightCodeToHtml', () => {
  it('highlights a bundled language into line elements', async () => {
    const html = await highlightCodeToHtml('const answer = 42;', 'typescript', 'light');

    expect(html).toContain('<pre');
    expect(html).toContain('class="line"');
    expect(html).toContain('answer');
  });

  it('loads a grammar through its alias', async () => {
    const html = await highlightCodeToHtml('echo "hi"', 'bash', 'light');

    expect(html).toContain('class="line"');
    expect(html).toContain('echo');
  });

  it('renders unknown languages as plaintext instead of throwing', async () => {
    const html = await highlightCodeToHtml('+++[->+++<]', 'brainfuck', 'light');

    expect(html).toContain('class="line"');
    expect(html).toContain('+++');
  });

  it('applies the dark theme when requested', async () => {
    const light = await highlightCodeToHtml('const a = 1;', 'typescript', 'light');
    const dark = await highlightCodeToHtml('const a = 1;', 'typescript', 'dark');

    expect(light).not.toBe(dark);
  });

  it('escapes markup in the source', async () => {
    const html = await highlightCodeToHtml('<script>alert(1)</script>', 'plaintext', 'light');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&#x3C;script>');
  });
});
