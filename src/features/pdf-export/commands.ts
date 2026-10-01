import type { CommandContributionFactory, PdfContribution } from '../../app/feature';
import { selectActiveFile, useWorkspaceStore } from '../../store/workspace';
import { exportPreviewToPdf, logPdfExport, pdfExportErrorDetails } from './export';
import { usePdfExportStore } from './store';
import { translateCurrent } from '../../i18n/current';
import { dismissNotification, notify, notifyError } from '../../core/notifications';

const EXPORT_NOTIFICATION_KEY = 'pdf-export';

export const pdfExportCommands: CommandContributionFactory = (ctx) => [
  {
    id: 'pdf.exportCurrent',
    label: translateCurrent('command.exportPdf'),
    defaultShortcut: 'mod+shift+e',
    menu: { section: 'file', label: translateCurrent('command.exportPdf'), group: 'output', order: 80 },
    isEnabled: ctx.file.hasDocument,
    run: exportCurrentPdf,
  },
];

export const pdfExportContribution: PdfContribution = {
  exportCurrent: exportCurrentPdf,
};

export async function exportCurrentPdf(): Promise<void> {
  const activeFile = selectActiveFile(useWorkspaceStore.getState());
  const { setStatus } = usePdfExportStore.getState();

  /*
   * Export can run for several seconds. The status-bar text alone was easy to
   * miss and said nothing about why a failure happened, so the outcome is
   * reported as a notification too - with the reason, and a way to retry.
   */
  notify(translateCurrent('pdf.exporting'), { key: EXPORT_NOTIFICATION_KEY, tone: 'info', timeout: null });

  try {
    logPdfExport('command start', { activeFileName: activeFile?.name ?? null });
    setStatus('exporting');
    const exported = await exportPreviewToPdf({ suggestedName: activeFile?.name });
    logPdfExport('command result', { exported });
    setStatus(exported ? 'done' : 'idle');
    if (exported) {
      notify(translateCurrent('pdf.done'), { key: EXPORT_NOTIFICATION_KEY, tone: 'success' });
      window.setTimeout(() => setStatus('idle'), 3000);
    } else {
      /* Cancelling the save dialog is not an error; say nothing. */
      dismissNotification(EXPORT_NOTIFICATION_KEY);
    }
  } catch (error) {
    console.error('PDF export failed:', error);
    logPdfExport('command failed', pdfExportErrorDetails(error));
    setStatus('error');
    notifyError(translateCurrent('pdf.error'), error, {
      key: EXPORT_NOTIFICATION_KEY,
      action: { label: translateCurrent('common.retry'), run: () => void exportCurrentPdf() },
    });
    window.setTimeout(() => setStatus('idle'), 4000);
  }
}
