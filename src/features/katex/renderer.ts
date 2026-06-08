import katex from 'katex';
import markdownItKatex from 'markdown-it-katex';
import { registerMarkdownItPlugin, setMarkdownMathRenderer } from '../../lib/markdown/extensions';
import { escapeHtml } from '../../lib/markdown/escape';

const katexOptions = {
  throwOnError: false,
  errorColor: '#cc3344',
};

registerMarkdownItPlugin({
  id: 'katex',
  apply(markdown) {
    markdown.use(markdownItKatex, katexOptions);
  },
});

setMarkdownMathRenderer({
  renderInline(content) {
    return katex.renderToString(content, {
      ...katexOptions,
      displayMode: false,
    });
  },
  renderBlock(content, attrs) {
    const equations = splitKatexBlockEquations(content);
    const equationCounts = new Map<string, number>();
    const html = equations
      .map((equation, index) => {
        const equationHtml = katex.renderToString(equation, {
          ...katexOptions,
          displayMode: true,
        });
        const equationKey = stableEquationKey(equation, equationCounts);
        return `<div class="math-equation" data-equation-index="${index}" data-equation-key="${escapeHtml(equationKey)}">${equationHtml}</div>`;
      })
      .join('');
    return `<div class="math-block"${attrs} data-label="katex"><div class="math-equation-list">${html}</div></div>\n`;
  },
});

function splitKatexBlockEquations(content: string): string[] {
  const normalized = content.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [''];
  if (/\\(?:begin|end)\s*\{/.test(normalized)) return [normalized];

  const equations = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return equations.length > 0 ? equations : [normalized];
}

function stableEquationKey(equation: string, counts: Map<string, number>): string {
  const hash = stableHash(equation);
  const occurrence = counts.get(hash) ?? 0;
  counts.set(hash, occurrence + 1);
  return `${hash}:${occurrence}`;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
