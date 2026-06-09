import { Backend } from '../../platform/common/backend';

const EXPORT_ROOT_CLASS = 'pdf-export-root';
const PAGE_SPACER_CLASS = 'pdf-page-spacer';
const A4_WIDTH_PX = 794;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const A4_HEIGHT_PX = (A4_WIDTH_PX * A4_HEIGHT_PT) / A4_WIDTH_PT;
const CANVAS_WHITE_THRESHOLD = 248;
const CANVAS_BOTTOM_TRIM_STEP_PX = 2;
const MIN_PDF_PAGE_SLICE_PX = 8;
const IMAGE_INLINE_TIMEOUT_MS = 5000;
const BASE64_CHUNK_SIZE = 0x8000;
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
  root.querySelectorAll('.preview-layout-tools, .preview-mode-tabs').forEach((node) => node.remove());
  root.querySelectorAll<HTMLElement>('.preview-layout-block[data-selected="true"]').forEach((node) => {
    delete node.dataset.selected;
  });
  root.querySelectorAll<HTMLElement>('[data-layout-selection-bound]').forEach((node) => {
    delete node.dataset.layoutSelectionBound;
  });
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

  for (let offsetY = 0, pageIndex = 0; offsetY < effectiveHeight; offsetY += pageHeightPx, pageIndex += 1) {
    const remainingHeight = effectiveHeight - offsetY;
    if (pageIndex > 0 && remainingHeight < MIN_PDF_PAGE_SLICE_PX) break;

    const sliceHeight = Math.min(pageHeightPx, remainingHeight);
    pageCanvas.height = sliceHeight;
    pageContext.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageContext.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, pageCanvas.width, sliceHeight);

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const sliceHeightPt = (sliceHeight * A4_WIDTH_PT) / canvas.width;
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_WIDTH_PT, sliceHeightPt);
  }

  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  logPdfExport('jspdf output done', { byteLength: bytes.byteLength });
  return bytes;
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

  const avoidBlocks = Array.from(
    root.querySelectorAll<HTMLElement>(PAGE_BREAK_AVOID_SELECTOR),
  ).filter((element) => isPageBreakCandidate(element));

  for (const block of avoidBlocks) {
    const height = block.offsetHeight;
    if (height <= 0 || height >= A4_HEIGHT_PX * 0.86) continue;

    const top = block.offsetTop;
    const bottom = top + height;
    const pageBottom = (Math.floor(top / A4_HEIGHT_PX) + 1) * A4_HEIGHT_PX;

    if (bottom <= pageBottom) continue;

    const spacer = document.createElement('div');
    spacer.className = PAGE_SPACER_CLASS;
    spacer.style.height = `${pageBottom - top}px`;
    block.before(spacer);
  }
}

function isPageBreakCandidate(element: HTMLElement): boolean {
  if (element.closest(`.${PAGE_SPACER_CLASS}`)) return false;
  if (element.closest('.katex')) return false;

  const parentAvoidBlock = element.parentElement?.closest(PAGE_BREAK_AVOID_SELECTOR);
  if (!parentAvoidBlock) return true;

  return !element.closest('table, pre, blockquote, .shiki, .mermaid-block, .math-block, .katex-display');
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
