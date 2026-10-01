import type { HighlighterCore } from 'shiki/core';

export type CodeHighlightTheme = 'light' | 'dark';

const SHIKI_THEME: Record<CodeHighlightTheme, string> = {
  light: 'github-light',
  dark: 'github-dark',
};

export const PLAIN_LANGUAGE = 'plaintext';

/**
 * Grammars bundled with the app, keyed by the canonical shiki language id.
 *
 * Importing from `shiki` directly would pull in the full bundled-language map,
 * which makes the build emit a chunk for every one of shiki's ~350 grammars.
 * Listing the grammars explicitly keeps the emitted chunks to this set, and
 * each grammar is still fetched on demand the first time a block needs it.
 */
const LANGUAGE_MODULES: Record<string, () => Promise<unknown>> = {
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  css: () => import('@shikijs/langs/css'),
  diff: () => import('@shikijs/langs/diff'),
  dockerfile: () => import('@shikijs/langs/dockerfile'),
  go: () => import('@shikijs/langs/go'),
  graphql: () => import('@shikijs/langs/graphql'),
  html: () => import('@shikijs/langs/html'),
  ini: () => import('@shikijs/langs/ini'),
  java: () => import('@shikijs/langs/java'),
  javascript: () => import('@shikijs/langs/javascript'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  jsx: () => import('@shikijs/langs/jsx'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  less: () => import('@shikijs/langs/less'),
  lua: () => import('@shikijs/langs/lua'),
  make: () => import('@shikijs/langs/make'),
  markdown: () => import('@shikijs/langs/markdown'),
  nginx: () => import('@shikijs/langs/nginx'),
  perl: () => import('@shikijs/langs/perl'),
  php: () => import('@shikijs/langs/php'),
  powershell: () => import('@shikijs/langs/powershell'),
  python: () => import('@shikijs/langs/python'),
  r: () => import('@shikijs/langs/r'),
  ruby: () => import('@shikijs/langs/ruby'),
  rust: () => import('@shikijs/langs/rust'),
  scss: () => import('@shikijs/langs/scss'),
  shellscript: () => import('@shikijs/langs/shellscript'),
  sql: () => import('@shikijs/langs/sql'),
  svelte: () => import('@shikijs/langs/svelte'),
  swift: () => import('@shikijs/langs/swift'),
  toml: () => import('@shikijs/langs/toml'),
  tsx: () => import('@shikijs/langs/tsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  vue: () => import('@shikijs/langs/vue'),
  xml: () => import('@shikijs/langs/xml'),
  yaml: () => import('@shikijs/langs/yaml'),
  zig: () => import('@shikijs/langs/zig'),
};

/** Fence tokens that shiki resolves through a grammar's own `aliases` field. */
const LANGUAGE_ALIASES: Record<string, string> = {
  'c#': 'csharp',
  'c++': 'cpp',
  bash: 'shellscript',
  cjs: 'javascript',
  cs: 'csharp',
  cts: 'typescript',
  gql: 'graphql',
  js: 'javascript',
  kt: 'kotlin',
  kts: 'kotlin',
  makefile: 'make',
  md: 'markdown',
  mjs: 'javascript',
  mts: 'typescript',
  properties: 'ini',
  ps: 'powershell',
  ps1: 'powershell',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'shellscript',
  shell: 'shellscript',
  ts: 'typescript',
  yml: 'yaml',
  zsh: 'shellscript',
};

/** Tokens shiki renders without a grammar. */
const PLAIN_LANGUAGE_TOKENS = new Set([PLAIN_LANGUAGE, 'text', 'txt', 'plain', 'ansi']);

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLanguages = new Map<string, Promise<void>>();

async function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createOnigurumaEngine }] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/oniguruma'),
    ]);

    return createHighlighterCore({
      themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark')],
      langs: [],
      engine: createOnigurumaEngine(import('shiki/wasm')),
    });
  })();

  return highlighterPromise;
}

/**
 * Maps a fence token onto a bundled grammar id, or `plaintext` when the token is
 * unknown. Falling back to plaintext rather than skipping shiki keeps every code
 * block on the same markup shape, so line elements and source-line anchors stay
 * consistent regardless of the language.
 */
export function resolveLanguage(lang: string | null | undefined): string {
  if (!lang) return PLAIN_LANGUAGE;
  const token = lang.trim().toLowerCase();
  if (!token || PLAIN_LANGUAGE_TOKENS.has(token)) return PLAIN_LANGUAGE;
  const canonical = LANGUAGE_ALIASES[token] ?? token;
  return canonical in LANGUAGE_MODULES ? canonical : PLAIN_LANGUAGE;
}

async function ensureLanguageLoaded(highlighter: HighlighterCore, language: string): Promise<void> {
  if (language === PLAIN_LANGUAGE) return;
  const loader = LANGUAGE_MODULES[language];
  if (!loader) return;

  let pending = loadedLanguages.get(language);
  if (!pending) {
    pending = loader().then((module) => highlighter.loadLanguage(module as never));
    loadedLanguages.set(language, pending);
  }

  try {
    await pending;
  } catch (error) {
    loadedLanguages.delete(language);
    throw error;
  }
}

/**
 * Highlights `code` and returns shiki's `<pre>` markup. Unknown languages are
 * rendered as plaintext instead of throwing.
 */
export async function highlightCodeToHtml(
  code: string,
  lang: string | null | undefined,
  theme: CodeHighlightTheme,
): Promise<string> {
  const highlighter = await getHighlighter();
  const language = resolveLanguage(lang);
  await ensureLanguageLoaded(highlighter, language);

  return highlighter.codeToHtml(code, { lang: language, theme: SHIKI_THEME[theme] });
}

/** Test seam: drops the cached highlighter and loaded grammars. */
export function resetCodeHighlighter(): void {
  highlighterPromise = null;
  loadedLanguages.clear();
}
