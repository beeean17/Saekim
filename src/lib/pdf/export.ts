import { pickPdfExportPath, writePdfExport } from '../tauri/fs';
import { isTauriRuntime } from '../tauri/invoke';

const EXPORT_ROOT_CLASS = 'pdf-export-root';
const PAGE_SPACER_CLASS = 'pdf-page-spacer';
const A4_WIDTH_PX = 794;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const A4_HEIGHT_PX = (A4_WIDTH_PX * A4_HEIGHT_PT) / A4_WIDTH_PT;
const CANVAS_WHITE_THRESHOLD = 248;
const CANVAS_BOTTOM_TRIM_STEP_PX = 2;
const MIN_PDF_PAGE_SLICE_PX = 8;
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
  if (!preview) return false;

  const title = options.title || getDocumentTitle(preview, options.suggestedName);
  const suggestedName = toPdfFileName(options.suggestedName || title);
  const targetPath = await pickExportTarget(suggestedName);
  if (isTauriRuntime() && !targetPath) return false;

  const exportRoot = createPdfTemplate(preview);
  document.body.appendChild(exportRoot);

  try {
    prepareKatexForCanvas(exportRoot);
    await renderCodeBlocksForPdf(exportRoot);
    await renderMermaidForPdf(exportRoot);
    await waitForTemplateAssets(exportRoot);
    applyBlockPageBreaks(exportRoot);
    const pdfBytes = await renderTemplateToPdf(exportRoot);
    await savePdfBytes(pdfBytes, suggestedName, targetPath);
    return true;
  } finally {
    exportRoot.remove();
  }
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
      } catch {
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
        block.textContent = source;
        block.dataset.rendered = 'false';
      }
    }),
  );
}

async function renderTemplateToPdf(exportRoot: HTMLElement): Promise<Uint8Array> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(exportRoot, {
    backgroundColor: '#ffffff',
    scale: Math.min(2, window.devicePixelRatio || 1),
    useCORS: true,
    windowWidth: A4_WIDTH_PX,
  });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const pageHeightPx = Math.floor((canvas.width * A4_HEIGHT_PT) / A4_WIDTH_PT);
  const effectiveHeight = trimCanvasBottomWhitespace(canvas);
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

  return new Uint8Array(pdf.output('arraybuffer'));
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
  if (!isTauriRuntime()) {
    return null;
  }

  return pickPdfExportPath(suggestedName);
}

async function savePdfBytes(bytes: Uint8Array, suggestedName: string, targetPath: string | null): Promise<void> {
  if (targetPath) {
    await writePdfExport(targetPath, Array.from(bytes));
    return;
  }

  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  link.click();
  URL.revokeObjectURL(url);
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

