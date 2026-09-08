import type { CommandContributionFactory, PdfContribution } from '../../app/feature';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { exportPreviewToPdf, logPdfExport, pdfExportErrorDetails } from './export';
import { usePdfExportStore } from './store';
import { translateCurrent } from '../../i18n/current';

export const pdfExportCommands: CommandContributionFactory = () => [
  {
    id: 'pdf.exportCurrent',
    label: translateCurrent('command.exportPdf'),
    defaultShortcut: 'mod+shift+e',
    menu: { section: 'file', label: translateCurrent('command.exportPdf'), group: 'output', order: 80 },
    run: exportCurrentPdf,
  },
];

export const pdfExportContribution: PdfContribution = {
  exportCurrent: exportCurrentPdf,
};

export async function exportCurrentPdf(): Promise<void> {
  const activeFile = selectActiveFile(useWorkspaceStore.getState());
  const { setStatus } = usePdfExportStore.getState();

  try {
    logPdfExport('command start', { activeFileName: activeFile?.name ?? null });
    setStatus('exporting');
    const exported = await exportPreviewToPdf({ suggestedName: activeFile?.name });
    logPdfExport('command result', { exported });
    setStatus(exported ? 'done' : 'idle');
    if (exported) window.setTimeout(() => setStatus('idle'), 3000);
  } catch (error) {
    console.error('PDF export failed:', error);
    logPdfExport('command failed', pdfExportErrorDetails(error));
    setStatus('error');
    window.setTimeout(() => setStatus('idle'), 4000);
  }
}
