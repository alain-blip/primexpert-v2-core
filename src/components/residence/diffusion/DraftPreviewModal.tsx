import { X } from 'lucide-react';
import { useLanguage } from '../../../lib/i18n';
import { FinancialDataProvider } from '../../../context/FinancialDataContext';
import { PublicPreviewPanel } from './PublicPreviewPanel';

export interface DraftPreviewModalProps {
  open: boolean;
  onClose: () => void;
  residenceId: string;
}

export function DraftPreviewModal({ open, onClose, residenceId }: DraftPreviewModalProps) {
  const { t } = useLanguage();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-preview-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border-4 border-primexpert-dark bg-slate-100 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2
            id="draft-preview-title"
            className="text-[20px] font-black uppercase tracking-wide text-primexpert-dark"
          >
            {t('Aperçu brouillon — acheteur', 'Draft preview — buyer view')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-100"
            aria-label={t('Fermer', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <FinancialDataProvider residenceId={residenceId}>
          <PublicPreviewPanel showBuyerContracts variant="portal" />
        </FinancialDataProvider>
      </div>
    </div>
  );
}
