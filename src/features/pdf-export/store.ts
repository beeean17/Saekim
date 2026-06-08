import { create } from 'zustand';

export type PdfExportStatus = 'idle' | 'exporting' | 'done' | 'error';

interface PdfExportState {
  status: PdfExportStatus;
  setStatus(status: PdfExportStatus): void;
}

export const usePdfExportStore = create<PdfExportState>()((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}));

export function pdfExportStatusText(status: PdfExportStatus): string | null {
  if (status === 'exporting') return 'PDF export 진행중';
  if (status === 'done') return 'PDF export 완료';
  if (status === 'error') return 'PDF export 실패';
  return null;
}
