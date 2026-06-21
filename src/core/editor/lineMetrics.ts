export interface EditorLineMetrics {
  lineHeights: number[];
  lineTops: number[];
  paddingTop: number;
  rowHeight: number;
}

const LINE_HEIGHT_EPSILON = 0.01;

export function measureEditorLineMetrics(
  textarea: HTMLTextAreaElement,
  text = textarea.value,
  computedStyle = window.getComputedStyle(textarea),
): EditorLineMetrics {
  const rowHeight = measureEditorRowHeight(textarea, computedStyle) ?? fallbackEditorRowHeight(computedStyle);
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

  return snapToDevicePixel(rawLineHeight);
}

export function measureEditorRowHeight(
  textarea: HTMLTextAreaElement,
  computedStyle = window.getComputedStyle(textarea),
): number | null {
  const configuredRowHeight = getEditorRowHeight(computedStyle);
  if (!configuredRowHeight) return null;

  return measureNativeTextareaRowHeight(textarea, computedStyle, configuredRowHeight) ?? configuredRowHeight;
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
  const probe = document.createElement('textarea');

  probe.setAttribute('aria-hidden', 'true');
  probe.setAttribute('wrap', 'soft');
  Object.assign(probe.style, {
    position: 'absolute',
    top: '0',
    left: '-10000px',
    width: `${contentWidth}px`,
    height: '0',
    minHeight: '0',
    maxHeight: 'none',
    margin: '0',
    padding: '0',
    border: '0',
    boxSizing: 'content-box',
    overflow: 'hidden',
    visibility: 'hidden',
    pointerEvents: 'none',
    resize: 'none',
    appearance: 'none',
    fontFamily: computedStyle.fontFamily,
    fontSize: computedStyle.fontSize,
    fontWeight: computedStyle.fontWeight,
    fontStyle: computedStyle.fontStyle,
    letterSpacing: computedStyle.letterSpacing,
    lineHeight: `${rowHeight}px`,
    tabSize: computedStyle.tabSize,
    whiteSpace: computedStyle.whiteSpace,
    overflowWrap: computedStyle.overflowWrap,
    wordBreak: computedStyle.wordBreak,
  });

  document.body.append(probe);
  const lines = text.split('\n');
  const heights = lines.map((line) => {
    probe.value = line.length > 0 ? line : ' ';
    return quantizeWrappedHeight(probe.scrollHeight, rowHeight);
  });
  probe.remove();

  return heights.length > 0 ? heights : [rowHeight];
}

export function lineHeightsEqual(current: number[], next: number[]): boolean {
  if (current.length !== next.length) return false;
  return current.every((height, index) => Math.abs(height - next[index]) < LINE_HEIGHT_EPSILON);
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

function quantizeWrappedHeight(measuredHeight: number, rowHeight: number): number {
  if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) return rowHeight;

  const visualRows = Math.max(1, Math.round(measuredHeight / rowHeight));
  return visualRows * rowHeight;
}

function measureNativeTextareaRowHeight(
  textarea: HTMLTextAreaElement,
  computedStyle: CSSStyleDeclaration,
  configuredRowHeight: number,
): number | null {
  const lineCount = 80;
  const probe = document.createElement('textarea');

  probe.value = Array.from({ length: lineCount }, (_, index) => `x ${index}`).join('\n');
  probe.setAttribute('aria-hidden', 'true');
  probe.setAttribute('wrap', 'off');
  Object.assign(probe.style, {
    position: 'fixed',
    top: '0',
    left: '-10000px',
    width: `${Math.max(1, textarea.clientWidth)}px`,
    height: '0',
    minHeight: '0',
    maxHeight: 'none',
    margin: '0',
    padding: '0',
    border: '0',
    boxSizing: 'content-box',
    overflow: 'hidden',
    visibility: 'hidden',
    pointerEvents: 'none',
    fontFamily: computedStyle.fontFamily,
    fontSize: computedStyle.fontSize,
    fontWeight: computedStyle.fontWeight,
    fontStyle: computedStyle.fontStyle,
    letterSpacing: computedStyle.letterSpacing,
    lineHeight: `${configuredRowHeight}px`,
    tabSize: computedStyle.tabSize,
    whiteSpace: 'pre',
  });

  document.body.append(probe);
  const contentHeight = probe.scrollHeight;
  probe.remove();

  const measuredRowHeight = contentHeight / lineCount;
  if (!Number.isFinite(measuredRowHeight) || measuredRowHeight <= 0) return null;

  return snapToDevicePixel(measuredRowHeight);
}

function snapToDevicePixel(value: number): number {
  const pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.round(value * pixelRatio) / pixelRatio;
}
