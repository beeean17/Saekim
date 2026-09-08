import { afterEach, describe, expect, it, vi } from 'vitest';

import { Backend } from '../../platform/common/backend';
import { exportPreviewToPdf } from './export';

describe('native vector PDF export', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('hands the prepared semantic preview to the native renderer and cleans up', async () => {
    document.body.innerHTML = `
      <div class="app">
        <article class="preview-content">
          <h1>Vector document</h1>
          <p>Selectable <a href="https://example.com/docs">linked text</a></p>
          <svg aria-label="diagram"><path d="M 0 0 L 10 10"></path></svg>
        </article>
      </div>
    `;

    vi.spyOn(Backend.runtime, 'isTauriRuntime').mockReturnValue(true);
    vi.spyOn(Backend.runtime, 'logEvent').mockResolvedValue();
    vi.spyOn(Backend.export, 'pickPdfExportPath').mockResolvedValue('/tmp/vector.pdf');
    const nativeRenderer = vi.spyOn(Backend.export, 'printWebviewPdf').mockImplementation(async (path, width, height) => {
      expect(path).toBe('/tmp/vector.pdf');
      expect(width).toBe(794);
      expect(height).toBeGreaterThan(1100);
      expect(document.body.classList.contains('pdf-exporting')).toBe(true);

      const exportRoot = document.querySelector<HTMLElement>('.pdf-export-root');
      expect(exportRoot?.textContent).toContain('Selectable linked text');
      expect(exportRoot?.querySelector('a')?.getAttribute('href')).toBe('https://example.com/docs');
      expect(exportRoot?.querySelector('svg path')).not.toBeNull();
      return { status: 'saved', path };
    });
    const rasterWriter = vi.spyOn(Backend.export, 'writePdfExport');

    await expect(exportPreviewToPdf({ suggestedName: 'vector.md' })).resolves.toBe(true);

    expect(nativeRenderer).toHaveBeenCalledOnce();
    expect(rasterWriter).not.toHaveBeenCalled();
    expect(document.body.classList.contains('pdf-exporting')).toBe(false);
    expect(document.querySelector('.pdf-export-root')).toBeNull();
  });
});
