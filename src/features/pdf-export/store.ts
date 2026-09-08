import { create } from 'zustand';
import { translate, type AppLanguage } from '../../i18n/messages';

export type PdfExportStatus = 'idle' | 'exporting' | 'done' | 'error';

interface PdfExportState {
  status: PdfExportStatus;
  setStatus(status: PdfExportStatus): void;
}

export const usePdfExportStore = create<PdfExportState>()((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}));

export function pdfExportStatusText(status: PdfExportStatus, language: AppLanguage = 'ko'): string | null {
  if (status === 'exporting') return translate(language, 'pdf.exporting');
  if (status === 'done') return translate(language, 'pdf.done');
  if (status === 'error') return translate(language, 'pdf.error');
  return null;
}
