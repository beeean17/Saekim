import { pickPdfExportPath, writePdfExport } from '../tauri/fs';
import { isTauriRuntime } from '../tauri/invoke';

const EXPORT_ROOT_CLASS = 'pdf-export-root';
const A4_WIDTH_PX = 794;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

interface PdfExportOptions {
  suggestedName?: string;
  title?: string;
}

export async function exportPreviewToPdf(options: PdfExportOptions = {}): Promise<void> {
  const preview = document.querySelector<HTMLElement>('.preview-content:not(.pdf-export-root)');
  if (!preview) return;

  const title = options.title || getDocumentTitle(preview, options.suggestedName);
  const suggestedName = toPdfFileName(options.suggestedName || title);
  const targetPath = await pickExportTarget(suggestedName);
  if (isTauriRuntime() && !targetPath) return;

  const exportRoot = createPdfTemplate(preview, title);
  document.body.appendChild(exportRoot);

  try {
    await waitForTemplateAssets(exportRoot);
    const pdfBytes = await renderTemplateToPdf(exportRoot);
    await savePdfBytes(pdfBytes, suggestedName, targetPath);
  } finally {
    exportRoot.remove();
  }
}

function createPdfTemplate(preview: HTMLElement, title: string): HTMLElement {
  document.querySelectorAll(`.${EXPORT_ROOT_CLASS}`).forEach((node) => node.remove());

  const exportRoot = document.createElement('article');
  exportRoot.className = `${EXPORT_ROOT_CLASS} preview-content`;
  exportRoot.setAttribute('aria-hidden', 'true');
  exportRoot.innerHTML = `
    <header class="pdf-cover">
      <p class="pdf-kicker">Saekim Markdown Export</p>
      <h1>${escapeHtml(title)}</h1>
    </header>
    <main class="pdf-content">${preview.innerHTML}</main>
  `;

  return exportRoot;
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
  const pageCanvas = document.createElement('canvas');
  const pageContext = pageCanvas.getContext('2d');

  if (!pageContext) {
    throw new Error('PDF canvas context unavailable');
  }

  pageCanvas.width = canvas.width;

  for (let offsetY = 0, pageIndex = 0; offsetY < canvas.height; offsetY += pageHeightPx, pageIndex += 1) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
