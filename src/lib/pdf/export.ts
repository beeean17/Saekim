const printCss = `
@page {
  size: A4;
  margin: 20mm 18mm;
}

@media print {
  html,
  body {
    background: white !important;
    color: #111 !important;
  }

  body {
    font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
  }

  pre,
  blockquote,
  table,
  img,
  .mermaid-block,
  .katex-display {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  h1,
  h2,
  h3 {
    break-after: avoid;
    page-break-after: avoid;
  }
}
`;

export async function exportPreviewToPdf(): Promise<void> {
  const preview = document.querySelector<HTMLElement>('.preview-content');
  if (!preview) return;

  const printWindow = window.open('', 'saekim-print-preview', 'width=960,height=720');
  if (!printWindow) return;

  const styles = Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n');

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="ko" data-theme="${document.documentElement.getAttribute('data-theme') || 'default'}">
  <head>
    <meta charset="UTF-8" />
    <title>Saekim PDF Export</title>
    ${styles}
    <style>${printCss}</style>
  </head>
  <body>
    <main class="preview-content">${preview.innerHTML}</main>
  </body>
</html>`);
  printWindow.document.close();

  await waitForPrintAssets(printWindow);
  printWindow.focus();
  printWindow.print();
}

async function waitForPrintAssets(printWindow: Window): Promise<void> {
  const fontsReady = printWindow.document.fonts?.ready ?? Promise.resolve();
  const images = Array.from(printWindow.document.images).map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  });

  await Promise.all([fontsReady, ...images]);
  await new Promise((resolve) => printWindow.setTimeout(resolve, 80));
}
