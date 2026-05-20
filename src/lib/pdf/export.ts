const EXPORT_ROOT_CLASS = 'pdf-export-root';
const EXPORTING_CLASS = 'pdf-exporting';

export async function exportPreviewToPdf(): Promise<void> {
  const preview = document.querySelector<HTMLElement>('.preview-content:not(.pdf-export-root)');
  if (!preview) return;

  const printRoot = createPrintRoot(preview);
  document.body.appendChild(printRoot);
  document.body.classList.add(EXPORTING_CLASS);

  const cleanup = createPrintCleanup(printRoot);
  window.addEventListener('afterprint', cleanup, { once: true });

  try {
    await waitForPrintAssets(printRoot);
    window.print();
    window.setTimeout(cleanup, 60_000);
  } catch (error) {
    cleanup();
    throw error;
  }
}

function createPrintRoot(preview: HTMLElement): HTMLElement {
  document.querySelectorAll(`.${EXPORT_ROOT_CLASS}`).forEach((node) => node.remove());

  const printRoot = document.createElement('main');
  printRoot.className = `${EXPORT_ROOT_CLASS} preview-content`;
  printRoot.innerHTML = preview.innerHTML;

  return printRoot;
}

function createPrintCleanup(printRoot: HTMLElement): () => void {
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener('afterprint', cleanup);
    printRoot.remove();
    document.body.classList.remove(EXPORTING_CLASS);
  };

  return cleanup;
}

async function waitForPrintAssets(root: HTMLElement): Promise<void> {
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
