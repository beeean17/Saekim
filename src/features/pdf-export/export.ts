import { Backend } from '../../platform/common/backend';

const EXPORT_ROOT_CLASS = 'pdf-export-root';
const PAGE_SPACER_CLASS = 'pdf-page-spacer';
const A4_WIDTH_PX = 794;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const A4_HEIGHT_PX = (A4_WIDTH_PX * A4_HEIGHT_PT) / A4_WIDTH_PT;
const CANVAS_WHITE_THRESHOLD = 248;
const CANVAS_BOTTOM_TRIM_STEP_PX = 2;
const CANVAS_QUIET_ROW_LUMINANCE_THRESHOLD = 235;
const CANVAS_QUIET_ROW_MAX_INK_RATIO = 0.012;
const MIN_PDF_PAGE_SLICE_PX = 8;
const PDF_PAGE_SLICE_BACKTRACK_PX = 140;
const IMAGE_INLINE_TIMEOUT_MS = 5000;
const BASE64_CHUNK_SIZE = 0x8000;
const PAGE_BREAK_KEEP_MARGIN_PX = 14;
const PAGE_BREAK_MAX_KEEP_RATIO = 0.92;
const PAGE_BREAK_REPEAT_LIMIT = 3;
const PAGE_BREAK_SLOP_PX = 2;
const UNSUPPORTED_CANVAS_COLOR_PATTERN = /\b(?:color|color-mix|lab|lch|oklab|oklch)\(/i;
const CSS_COLOR_FUNCTION_PATTERN = /color\(\s*(?:srgb|display-p3)\s+([^)]*)\)/gi;
const PAGE_BREAK_AVOID_SELECTOR = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'table',
  'img',
  'pre',
  'blockquote',
  '.shiki',
  '.preview-layout-block',
  '.preview-layout-group',
  '.mermaid-block',
  '.math-block',
  '.katex-display',
].join(', ');
const CANVAS_COLOR_FALLBACKS = [
  ['accent-color', '#5f6bff'],
  ['background-color', 'transparent'],
  ['border-block-color', '#d8dde8'],
  ['border-block-end-color', '#d8dde8'],
  ['border-block-start-color', '#d8dde8'],
  ['border-bottom-color', '#d8dde8'],
  ['border-color', '#d8dde8'],
  ['border-inline-color', '#d8dde8'],
  ['border-inline-end-color', '#d8dde8'],
  ['border-inline-start-color', '#d8dde8'],
  ['border-left-color', '#d8dde8'],
  ['border-right-color', '#d8dde8'],
  ['border-top-color', '#d8dde8'],
  ['caret-color', 'transparent'],
  ['color', '#111827'],
  ['column-rule-color', '#d8dde8'],
  ['fill', '#111827'],
  ['flood-color', '#ffffff'],
  ['lighting-color', '#ffffff'],
  ['outline-color', '#d8dde8'],
  ['stop-color', '#111827'],
  ['stroke', '#111827'],
  ['text-decoration-color', '#111827'],
] as const;
const CANVAS_EFFECT_FALLBACKS = [
  ['box-shadow', 'none'],
  ['filter', 'none'],
  ['text-shadow', 'none'],
] as const;

interface PdfExportOptions {
  suggestedName?: string;
  title?: string;
}

export async function exportPreviewToPdf(options: PdfExportOptions = {}): Promise<boolean> {
  const preview = document.querySelector<HTMLElement>('.preview-content:not(.pdf-export-root)');
  if (!preview) {
    logPdfExport('preview not found');
    return false;
  }

  const title = options.title || getDocumentTitle(preview, options.suggestedName);
  const suggestedName = toPdfFileName(options.suggestedName || title);
  logPdfExport('export start', {
    isTauriRuntime: Backend.runtime.isTauriRuntime(),
    suggestedName,
    title,
  });
  const targetPath = await pickExportTarget(suggestedName);
  if (Backend.runtime.isTauriRuntime() && !targetPath) {
    logPdfExport('export cancelled before render');
    return false;
  }

  const exportRoot = createPdfTemplate(preview);
  document.body.appendChild(exportRoot);
  logPdfExport('template appended', readElementMetrics(exportRoot));

  try {
    logPdfExport('prepare katex start');
    prepareKatexForCanvas(exportRoot);
    logPdfExport('prepare katex done');

    logPdfExport('render code blocks start', {
      count: exportRoot.querySelectorAll('pre[data-lang]').length,
    });
    await renderCodeBlocksForPdf(exportRoot);
    logPdfExport('render code blocks done');

    logPdfExport('render mermaid start', {
      count: exportRoot.querySelectorAll('.mermaid-block[data-source]').length,
    });
    await renderMermaidForPdf(exportRoot);
    logPdfExport('render mermaid done');

    await inlineImagesForPdf(exportRoot);
    logPdfExport('wait assets start');
    await waitForTemplateAssets(exportRoot);
    logPdfExport('wait assets done', readElementMetrics(exportRoot));

    logPdfExport('apply page breaks start');
    applyBlockPageBreaks(exportRoot);
    logPdfExport('apply page breaks done', {
      spacerCount: exportRoot.querySelectorAll(`.${PAGE_SPACER_CLASS}`).length,
    });

    const pdfBytes = await renderTemplateToPdf(exportRoot);
    logPdfExport('pdf bytes rendered', { byteLength: pdfBytes.byteLength });
    await savePdfBytes(pdfBytes, suggestedName, targetPath);
    logPdfExport('export done', { targetPath, byteLength: pdfBytes.byteLength });
    return true;
  } catch (error) {
    logPdfExport('export failed', pdfExportErrorDetails(error));
    throw error;
  } finally {
    exportRoot.remove();
    logPdfExport('template removed');
  }
}

export function logPdfExport(message: string, details?: unknown): void {
  void Backend.runtime.logEvent('pdf-export', message, details).catch((error) => {
    console.warn('failed to write PDF export log', error);
  });
}

export function pdfExportErrorDetails(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? '',
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
}

function createPdfTemplate(preview: HTMLElement): HTMLElement {
  document.querySelectorAll(`.${EXPORT_ROOT_CLASS}`).forEach((node) => node.remove());

  const exportRoot = document.createElement('article');
  exportRoot.className = `${EXPORT_ROOT_CLASS} preview-content`;
  exportRoot.setAttribute('aria-hidden', 'true');

  const content = document.createElement('main');
  content.className = 'pdf-content';
  const previewClone = clonePreviewForPdf(preview);
  while (previewClone.firstChild) {
    content.append(previewClone.firstChild);
  }

  exportRoot.append(content);

  return exportRoot;
}

function clonePreviewForPdf(preview: HTMLElement): HTMLElement {
  const clone = preview.cloneNode(true) as HTMLElement;
  inlineBrowserFramePreviews(preview, clone);
  sanitizePdfPreviewClone(clone);
  return clone;
}

function inlineBrowserFramePreviews(source: HTMLElement, clone: HTMLElement): void {
  const sourceFrames = Array.from(source.querySelectorAll<HTMLIFrameElement>('iframe.html-preview-frame'));
  const cloneFrames = Array.from(clone.querySelectorAll<HTMLIFrameElement>('iframe.html-preview-frame'));

  cloneFrames.forEach((frame, index) => {
    const replacement = document.createElement('div');
    replacement.className = 'html-preview';

    const sourceDocument = sourceFrames[index]?.contentDocument;
    if (sourceDocument?.body) {
      replacement.innerHTML = sourceDocument.body.innerHTML;
    }

    frame.replaceWith(replacement);
  });
}

function sanitizePdfPreviewClone(root: HTMLElement): void {
  root.querySelectorAll('.preview-layout-tools, .preview-mode-tabs, .math-equation-tools').forEach((node) => node.remove());
  replaceFormControlsForPdf(root);
  root.querySelectorAll<HTMLElement>('.preview-layout-block[data-selected="true"]').forEach((node) => {
    delete node.dataset.selected;
  });
  root.querySelectorAll<HTMLElement>('[data-layout-selection-bound]').forEach((node) => {
    delete node.dataset.layoutSelectionBound;
  });
}

function replaceFormControlsForPdf(root: HTMLElement): void {
  let replacedCheckboxes = 0;
  let replacedFields = 0;

  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((control) => {
    const replacement = staticFormControl(control);
    if (replacement.classList.contains('pdf-static-checkbox') || replacement.classList.contains('pdf-static-radio')) {
      replacedCheckboxes += 1;
    } else {
      replacedFields += 1;
    }

    control.replaceWith(replacement);
  });

  if (replacedCheckboxes > 0 || replacedFields > 0) {
    logPdfExport('form controls replaced for canvas', {
      checkboxCount: replacedCheckboxes,
      fieldCount: replacedFields,
    });
  }
}

function staticFormControl(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): HTMLElement {
  if (control instanceof HTMLInputElement) {
    const type = control.type.toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      const marker = document.createElement('span');
      marker.className = `pdf-static-control pdf-static-${type}`;
      marker.dataset.checked = String(control.checked);
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = control.checked ? (type === 'radio' ? '' : '\u2713') : '';
      return marker;
    }

    return staticFormValue(control.value || control.getAttribute('value') || control.placeholder);
  }

  if (control instanceof HTMLSelectElement) {
    return staticFormValue(control.selectedOptions[0]?.textContent?.trim() || control.value);
  }

  return staticFormValue(control.value || control.textContent || control.placeholder);
}

function staticFormValue(value: string | null | undefined): HTMLElement {
  const text = document.createElement('span');
  text.className = 'pdf-static-field';
  text.textContent = value?.trim() || '';
  return text;
}

function prepareKatexForCanvas(root: HTMLElement): void {
  root.querySelectorAll('.katex-mathml').forEach((node) => node.remove());
}

async function renderCodeBlocksForPdf(root: HTMLElement): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre[data-lang]'));
  if (blocks.length === 0) return;

  const { codeToHtml } = await import('shiki');
  await Promise.all(
    blocks.map(async (block) => {
      const lang = block.dataset.lang;
      if (!lang) return;

      try {
        const highlighted = await codeToHtml(block.textContent ?? '', {
          lang,
          theme: 'github-light',
        });
        const template = document.createElement('template');
        template.innerHTML = highlighted.trim();
        const highlightedPre = template.content.firstElementChild;
        if (highlightedPre instanceof HTMLElement) {
          enhancePdfCodeBlock(highlightedPre, lang);
          block.replaceWith(highlightedPre);
        }
      } catch (error) {
        logPdfExport('code block render failed', {
          lang,
          ...pdfExportErrorDetails(error),
        });
        block.classList.remove('shiki');
        block.removeAttribute('style');
      }
    }),
  );
}

function enhancePdfCodeBlock(pre: HTMLElement, lang: string): void {
  pre.dataset.lang = lang;
  pre.setAttribute('data-label', formatPdfLanguageLabel(lang));
  pre.querySelectorAll<HTMLElement>('.line').forEach((line, index) => {
    const text = line.textContent ?? '';
    line.dataset.line = String(index + 1);
    if (text.startsWith('+')) line.classList.add('diff-add');
    if (text.startsWith('-')) line.classList.add('diff-remove');
  });
}

function formatPdfLanguageLabel(lang: string): string {
  const normalized = lang.toLowerCase();
  const labels: Record<string, string> = {
    bash: 'Shell',
    cjs: 'JavaScript',
    cpp: 'C++',
    csharp: 'C#',
    css: 'CSS',
    diff: 'Diff',
    go: 'Go',
    html: 'HTML',
    java: 'Java',
    js: 'JavaScript',
    json: 'JSON',
    jsx: 'JSX',
    kotlin: 'Kotlin',
    kt: 'Kotlin',
    markdown: 'Markdown',
    md: 'Markdown',
    mjs: 'JavaScript',
    py: 'Python',
    python: 'Python',
    rs: 'Rust',
    rust: 'Rust',
    sh: 'Shell',
    shell: 'Shell',
    sql: 'SQL',
    swift: 'Swift',
    ts: 'TypeScript',
    tsx: 'TSX',
    txt: 'Text',
    yaml: 'YAML',
    yml: 'YAML',
  };
  return labels[normalized] ?? normalized.toUpperCase();
}

async function renderMermaidForPdf(root: HTMLElement): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block[data-source]'));
  if (blocks.length === 0) return;

  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'strict',
  });

  await Promise.all(
    blocks.map(async (block, index) => {
      const source = decodeURIComponent(block.dataset.source || '');
      if (!source) return;

      if (block.querySelector('svg')) return;

      try {
        const id = `pdf-mermaid-${Date.now()}-${index}`;
        const { svg } = await mermaid.render(id, source);
        block.innerHTML = svg;
      } catch (error) {
        console.error('failed to render mermaid block for PDF', error);
        logPdfExport('mermaid render failed', {
          index,
          ...pdfExportErrorDetails(error),
        });
        block.textContent = source;
        block.dataset.rendered = 'false';
      }
    }),
  );
}

async function renderTemplateToPdf(exportRoot: HTMLElement): Promise<Uint8Array> {
  logPdfExport('render template imports start');
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const captureHeight = Math.max(exportRoot.scrollHeight, exportRoot.offsetHeight, Math.ceil(A4_HEIGHT_PX));
  const normalizedDeclarationCount = normalizeUnsupportedCanvasStyles(exportRoot);
  if (normalizedDeclarationCount > 0) {
    logPdfExport('canvas styles normalized', { declarationCount: normalizedDeclarationCount });
  }
  logPdfExport('html2canvas start', {
    ...readElementMetrics(exportRoot),
    captureHeight,
    width: A4_WIDTH_PX,
    scale: Math.min(2, window.devicePixelRatio || 1),
  });
  const canvas = await html2canvas(exportRoot, {
    backgroundColor: '#ffffff',
    height: captureHeight,
    scale: Math.min(2, window.devicePixelRatio || 1),
    scrollX: 0,
    scrollY: 0,
    useCORS: true,
    width: A4_WIDTH_PX,
    windowWidth: A4_WIDTH_PX,
  });
  logPdfExport('html2canvas done', {
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
  });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const pageHeightPx = Math.floor((canvas.width * A4_HEIGHT_PT) / A4_WIDTH_PT);
  const effectiveHeight = trimCanvasBottomWhitespace(canvas);
  const sourceContext = canvas.getContext('2d', { willReadFrequently: true });
  logPdfExport('canvas trimmed', {
    pageHeightPx,
    effectiveHeight,
  });
  const pageCanvas = document.createElement('canvas');
  const pageContext = pageCanvas.getContext('2d');

  if (!pageContext) {
    throw new Error('PDF canvas context unavailable');
  }

  pageCanvas.width = canvas.width;

  for (let offsetY = 0, pageIndex = 0; offsetY < effectiveHeight; pageIndex += 1) {
    const remainingHeight = effectiveHeight - offsetY;
    if (pageIndex > 0 && remainingHeight < MIN_PDF_PAGE_SLICE_PX) break;

    const sliceHeight = pageSliceHeight(sourceContext, canvas, offsetY, pageHeightPx, effectiveHeight);
    pageCanvas.height = sliceHeight;
    pageContext.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageContext.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, pageCanvas.width, sliceHeight);

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const sliceHeightPt = (sliceHeight * A4_WIDTH_PT) / canvas.width;
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_WIDTH_PT, sliceHeightPt);
    offsetY += sliceHeight;
  }

  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  logPdfExport('jspdf output done', { byteLength: bytes.byteLength });
  return bytes;
}

function pageSliceHeight(
  context: CanvasRenderingContext2D | null,
  canvas: HTMLCanvasElement,
  offsetY: number,
  pageHeightPx: number,
  effectiveHeight: number,
): number {
  const remainingHeight = effectiveHeight - offsetY;
  if (remainingHeight <= pageHeightPx) return remainingHeight;
  if (!context) return pageHeightPx;

  const scale = canvas.width / A4_WIDTH_PX;
  const scanStep = Math.max(1, Math.round(CANVAS_BOTTOM_TRIM_STEP_PX * scale));
  const backtrackPx = Math.max(scanStep, Math.round(PDF_PAGE_SLICE_BACKTRACK_PX * scale));
  const minSliceHeight = Math.max(MIN_PDF_PAGE_SLICE_PX, pageHeightPx - backtrackPx);
  const scanStartY = offsetY + pageHeightPx - 1;
  const scanEndY = offsetY + minSliceHeight;

  for (let y = scanStartY; y >= scanEndY; y -= scanStep) {
    if (isQuietCanvasRow(context, canvas, y)) {
      const sliceHeight = y - offsetY + 1;
      if (sliceHeight >= MIN_PDF_PAGE_SLICE_PX) return sliceHeight;
    }
  }

  return pageHeightPx;
}

function isQuietCanvasRow(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, y: number): boolean {
  const row = context.getImageData(0, Math.max(0, Math.min(canvas.height - 1, Math.round(y))), canvas.width, 1).data;
  let inkPixels = 0;
  const maxInkPixels = Math.max(1, Math.floor(canvas.width * CANVAS_QUIET_ROW_MAX_INK_RATIO));

  for (let index = 0; index < row.length; index += 4) {
    const alpha = row[index + 3];
    if (alpha === 0) continue;

    const luminance = (0.2126 * row[index]) + (0.7152 * row[index + 1]) + (0.0722 * row[index + 2]);
    if (luminance < CANVAS_QUIET_ROW_LUMINANCE_THRESHOLD) {
      inkPixels += 1;
      if (inkPixels > maxInkPixels) return false;
    }
  }

  return true;
}

function normalizeUnsupportedCanvasStyles(root: HTMLElement): number {
  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  let normalizedCount = 0;

  elements.forEach((element) => {
    const style = editableStyle(element);
    if (!style) return;

    const computed = window.getComputedStyle(element);
    CANVAS_COLOR_FALLBACKS.forEach(([property, fallback]) => {
      const safeValue = canvasSafeStyleValue(computed.getPropertyValue(property), fallback);
      if (safeValue) {
        style.setProperty(property, safeValue, 'important');
        normalizedCount += 1;
      }
    });
    CANVAS_EFFECT_FALLBACKS.forEach(([property, fallback]) => {
      const safeValue = canvasSafeStyleValue(computed.getPropertyValue(property), fallback);
      if (safeValue) {
        style.setProperty(property, safeValue, 'important');
        normalizedCount += 1;
      }
    });
  });

  return normalizedCount;
}

function editableStyle(element: Element): CSSStyleDeclaration | null {
  if (element instanceof HTMLElement || element instanceof SVGElement) return element.style;
  return null;
}

function hasUnsupportedCanvasColor(value: string): boolean {
  return UNSUPPORTED_CANVAS_COLOR_PATTERN.test(value);
}

function canvasSafeStyleValue(value: string, fallback: string): string | null {
  if (!hasUnsupportedCanvasColor(value)) return null;

  const converted = value.replace(CSS_COLOR_FUNCTION_PATTERN, (_, body: string) => legacyColorFunctionValue(body) ?? fallback);
  return hasUnsupportedCanvasColor(converted) ? fallback : converted;
}

function legacyColorFunctionValue(body: string): string | null {
  const [colorBody, alphaBody] = body.split('/').map((part) => part.trim());
  const channels = colorBody.split(/\s+/).filter(Boolean).slice(0, 3).map(colorChannelToByte);
  if (channels.length !== 3 || channels.some((channel) => channel === null)) return null;

  const alpha = alphaBody ? colorAlpha(alphaBody) : 1;
  if (alpha === null) return null;

  const [red, green, blue] = channels as [number, number, number];
  if (alpha < 1) return `rgba(${red}, ${green}, ${blue}, ${roundAlpha(alpha)})`;
  return `rgb(${red}, ${green}, ${blue})`;
}

function colorChannelToByte(value: string): number | null {
  if (value.endsWith('%')) {
    const percent = Number(value.slice(0, -1));
    if (!Number.isFinite(percent)) return null;
    return Math.round(clamp(percent / 100, 0, 1) * 255);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(clamp(numeric, 0, 1) * 255);
}

function colorAlpha(value: string): number | null {
  if (value.endsWith('%')) {
    const percent = Number(value.slice(0, -1));
    if (!Number.isFinite(percent)) return null;
    return clamp(percent / 100, 0, 1);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clamp(numeric, 0, 1);
}

function roundAlpha(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function trimCanvasBottomWhitespace(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return canvas.height;

  for (let y = canvas.height - 1; y >= 0; y -= CANVAS_BOTTOM_TRIM_STEP_PX) {
    const row = context.getImageData(0, y, canvas.width, 1).data;
    if (!isWhitePixelRow(row)) {
      return Math.min(canvas.height, y + CANVAS_BOTTOM_TRIM_STEP_PX + 1);
    }
  }

  return Math.min(canvas.height, pageHeightFallback(canvas.width));
}

async function inlineImagesForPdf(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  logPdfExport('inline images start', { count: images.length });
  await Promise.all(images.map((image) => inlineImageForPdf(image)));
  logPdfExport('inline images done');
}

async function inlineImageForPdf(image: HTMLImageElement): Promise<void> {
  const src = image.currentSrc || image.src;
  if (!src || /^data:/i.test(src)) return;

  try {
    const blob = await fetchImageBlob(src);
    if (!blob.type.startsWith('image/')) {
      logPdfExport('image inline skipped non-image blob', {
        src: describeImageSource(src),
        type: blob.type,
      });
      return;
    }

    image.removeAttribute('srcset');
    image.src = await blobToDataUrl(blob);
    await waitForImage(image);
  } catch (error) {
    console.warn('failed to inline image for PDF export', error);
    logPdfExport('image inline failed', {
      src: describeImageSource(src),
      ...pdfExportErrorDetails(error),
    });
  }
}

async function fetchImageBlob(src: string): Promise<Blob> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), IMAGE_INLINE_TIMEOUT_MS);

  try {
    const response = await fetch(src, {
      credentials: 'include',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`image request failed: ${response.status}`);
    }
    return response.blob();
  } finally {
    window.clearTimeout(timeout);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('image data URL conversion failed'));
    }, { once: true });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('image data URL conversion failed')), { once: true });
    reader.readAsDataURL(blob);
  });
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve();

  return new Promise((resolve) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => resolve(), { once: true });
  });
}

function isWhitePixelRow(row: Uint8ClampedArray): boolean {
  for (let index = 0; index < row.length; index += 4) {
    const alpha = row[index + 3];
    if (alpha === 0) continue;
    if (
      row[index] < CANVAS_WHITE_THRESHOLD ||
      row[index + 1] < CANVAS_WHITE_THRESHOLD ||
      row[index + 2] < CANVAS_WHITE_THRESHOLD
    ) {
      return false;
    }
  }

  return true;
}

function pageHeightFallback(canvasWidth: number): number {
  return Math.floor((canvasWidth * A4_HEIGHT_PT) / A4_WIDTH_PT);
}

async function pickExportTarget(suggestedName: string): Promise<string | null> {
  if (!Backend.runtime.isTauriRuntime()) {
    logPdfExport('target picker skipped for browser');
    return null;
  }

  logPdfExport('target picker start', { suggestedName });
  const targetPath = await Backend.export.pickPdfExportPath(suggestedName);
  logPdfExport(targetPath ? 'target picker selected' : 'target picker cancelled', { targetPath });
  return targetPath;
}

async function savePdfBytes(bytes: Uint8Array, suggestedName: string, targetPath: string | null): Promise<void> {
  if (targetPath) {
    logPdfExport('native save start', {
      targetPath,
      byteLength: bytes.byteLength,
    });
    logPdfExport('base64 encode start', { byteLength: bytes.byteLength });
    const encoded = uint8ArrayToBase64(bytes);
    logPdfExport('base64 encode done', { base64Length: encoded.length });
    await Backend.export.writePdfExport(targetPath, encoded);
    logPdfExport('native save done', { targetPath });
    return;
  }

  logPdfExport('browser download start', {
    suggestedName,
    byteLength: bytes.byteLength,
  });
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  link.click();
  URL.revokeObjectURL(url);
  logPdfExport('browser download done', { suggestedName });
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(index, index + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function waitForTemplateAssets(root: HTMLElement): Promise<void> {
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  const images = Array.from(root.querySelectorAll('img')).map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  });

  await Promise.all([fontsReady, ...images]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function applyBlockPageBreaks(root: HTMLElement): void {
  root.querySelectorAll(`.${PAGE_SPACER_CLASS}`).forEach((node) => node.remove());

  for (let passIndex = 0; passIndex < PAGE_BREAK_REPEAT_LIMIT; passIndex += 1) {
    let insertedCount = 0;
    const avoidBlocks = Array.from(
      root.querySelectorAll<HTMLElement>(PAGE_BREAK_AVOID_SELECTOR),
    ).filter((element) => isPageBreakCandidate(element));

    for (const block of avoidBlocks) {
      if (insertPageSpacerBeforeBlock(root, block)) insertedCount += 1;
    }

    if (insertedCount === 0) {
      return;
    }
  }
}

function isPageBreakCandidate(element: HTMLElement): boolean {
  if (element.closest(`.${PAGE_SPACER_CLASS}`)) return false;
  if (element.closest('.katex')) return false;

  const parentAvoidBlock = element.parentElement?.closest(
    'li, p, table, pre, blockquote, .shiki, .mermaid-block, .math-block, .preview-layout-block, .preview-layout-group',
  );
  return !parentAvoidBlock;
}

function insertPageSpacerBeforeBlock(root: HTMLElement, block: HTMLElement): boolean {
  const rect = block.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const height = rect.height;
  if (height <= 0 || height >= A4_HEIGHT_PX * PAGE_BREAK_MAX_KEEP_RATIO) return false;

  const top = rect.top - rootRect.top;
  const bottom = top + height;
  const pageBottom = (Math.floor(top / A4_HEIGHT_PX) + 1) * A4_HEIGHT_PX;
  if (bottom <= pageBottom - PAGE_BREAK_SLOP_PX) return false;

  const spacerHeight = pageBottom - top + PAGE_BREAK_KEEP_MARGIN_PX;
  if (spacerHeight <= PAGE_BREAK_SLOP_PX) return false;

  const spacer = document.createElement('div');
  spacer.className = PAGE_SPACER_CLASS;
  spacer.style.height = `${spacerHeight}px`;
  block.before(spacer);
  return true;
}

function getDocumentTitle(preview: HTMLElement, suggestedName?: string): string {
  const heading = preview.querySelector('h1, h2, h3')?.textContent?.trim();
  if (heading) return heading;

  const name = suggestedName?.trim();
  if (name) return name.replace(/\.(md|markdown|txt)$/i, '');

  return 'Document';
}

function toPdfFileName(value: string): string {
  const baseName = value.trim().replace(/\.(md|markdown|txt|pdf)$/i, '') || 'document';
  return `${baseName}.pdf`;
}

function readElementMetrics(element: HTMLElement): Record<string, number> {
  return {
    childCount: element.childElementCount,
    offsetHeight: element.offsetHeight,
    offsetWidth: element.offsetWidth,
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
  };
}

function describeImageSource(src: string): string {
  if (/^data:/i.test(src)) return 'data-url';
  if (src.length <= 240) return src;
  return `${src.slice(0, 240)}...`;
}
