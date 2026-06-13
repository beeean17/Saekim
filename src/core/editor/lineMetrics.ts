export interface EditorLineMetrics {
  lineHeights: number[];
  lineTops: number[];
  paddingTop: number;
  rowHeight: number;
}

export function measureEditorLineMetrics(
  textarea: HTMLTextAreaElement,
  text = textarea.value,
  computedStyle = window.getComputedStyle(textarea),
): EditorLineMetrics {
  const rowHeight = getEditorRowHeight(computedStyle) ?? fallbackEditorRowHeight(computedStyle);
  const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
  const lineHeights = measureWrappedLineHeights(textarea, text, rowHeight, computedStyle);
  const lineTops: number[] = [];
  let nextTop = paddingTop;

  lineHeights.forEach((height) => {
    lineTops.push(nextTop);
    nextTop += height;
  });

  return {
    lineHeights,
    lineTops,
    paddingTop,
    rowHeight,
  };
}

export function getEditorRowHeight(computedStyle: CSSStyleDeclaration): number | null {
  const fontSizePx = Number.parseFloat(computedStyle.fontSize);
  const lineHeightRatio = Number.parseFloat(computedStyle.getPropertyValue('--editor-line-height')) || 1.75;
  const rawLineHeight = fontSizePx * lineHeightRatio;
  if (!Number.isFinite(rawLineHeight) || rawLineHeight <= 0) return null;

  return rawLineHeight;
}

export function measureWrappedLineHeights(
  textarea: HTMLTextAreaElement,
  text: string,
  rowHeight: number,
  computedStyle = window.getComputedStyle(textarea),
): number[] {
  const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
  const contentWidth = Math.max(1, textarea.clientWidth - paddingLeft - paddingRight);
  const mirror = document.createElement('div');

  Object.assign(mirror.style, {
    position: 'absolute',
    top: '0',
    left: '-10000px',
    width: `${contentWidth}px`,
    boxSizing: 'content-box',
    visibility: 'hidden',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    fontFamily: computedStyle.fontFamily,
    fontSize: computedStyle.fontSize,
    fontWeight: computedStyle.fontWeight,
    fontStyle: computedStyle.fontStyle,
    letterSpacing: computedStyle.letterSpacing,
    lineHeight: `${rowHeight}px`,
    tabSize: computedStyle.tabSize,
  });

  const lines = text.split('\n');
  lines.forEach((line) => {
    const row = document.createElement('div');
    row.textContent = line.length > 0 ? line : '\u200B';
    row.style.minHeight = `${rowHeight}px`;
    mirror.append(row);
  });

  document.body.append(mirror);
  const heights = Array.from(mirror.children, (row) => Math.max(rowHeight, row.getBoundingClientRect().height));
  mirror.remove();

  return heights.length > 0 ? heights : [rowHeight];
}

export function lineHeightsEqual(current: number[], next: number[]): boolean {
  if (current.length !== next.length) return false;
  return current.every((height, index) => Math.abs(height - next[index]) < 0.5);
}

export function editorLineMetricStyleKey(computedStyle: CSSStyleDeclaration): string {
  return [
    computedStyle.fontFamily,
    computedStyle.fontSize,
    computedStyle.fontWeight,
    computedStyle.fontStyle,
    computedStyle.letterSpacing,
    computedStyle.lineHeight,
    computedStyle.paddingLeft,
    computedStyle.paddingRight,
    computedStyle.paddingTop,
    computedStyle.tabSize,
    computedStyle.getPropertyValue('--editor-line-height'),
  ].join('|');
}

function fallbackEditorRowHeight(computedStyle: CSSStyleDeclaration): number {
  const parsed = Number.parseFloat(computedStyle.lineHeight);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const fontSize = Number.parseFloat(computedStyle.fontSize) || 13.5;
  return fontSize * 1.75;
}
