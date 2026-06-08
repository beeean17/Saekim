import type { CommandContributionFactory, PdfContribution } from '../../app/feature';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { exportPreviewToPdf } from './export';
import { usePdfExportStore } from './store';

export const pdfExportCommands: CommandContributionFactory = () => [
  {
    id: 'pdf.exportCurrent',
    defaultShortcut: 'mod+p',
    menu: { section: 'file', label: 'Export PDF' },
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
    setStatus('exporting');
    const exported = await exportPreviewToPdf({ suggestedName: activeFile?.name });
    setStatus(exported ? 'done' : 'idle');
    if (exported) window.setTimeout(() => setStatus('idle'), 3000);
  } catch (error) {
    console.error('PDF export failed:', error);
    setStatus('error');
    window.setTimeout(() => setStatus('idle'), 4000);
  }
}
