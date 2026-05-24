import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { resolveSellerContactId } from '@primexpert/core/residence';
import { useLanguage } from '../../lib/i18n';
import { useResidenceDocument } from '../../context/ResidenceDocumentContext';
import { cn } from '../../lib/utils';

export function ResidenceAccesVendeurButton({ residenceId }: { residenceId: string }) {
  const { t } = useLanguage();
  const { residenceDoc, loading } = useResidenceDocument();

  const sellerContactId = useMemo(
    () => resolveSellerContactId(residenceDoc),
    [residenceDoc]
  );

  const disabled = loading || !sellerContactId;
  const tooltip = t(
    'Aucun vendeur associé à ce dossier client',
    'No seller linked to this client file'
  );

  const handleOpen = () => {
    if (!sellerContactId) return;
    const params = new URLSearchParams({
      contactId: sellerContactId,
      residenceId,
    });
    window.open(`/acces-vendeur?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={disabled}
      title={disabled && !loading ? tooltip : undefined}
      aria-label={
        disabled && !loading
          ? tooltip
          : t("Ouvrir l'Accès Vendeur", 'Open Seller access')
      }
      className={cn(
        'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition shadow-sm border',
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
          : 'border-[#142c6a]/30 bg-gradient-to-r from-[#142c6a] to-primexpert-blue text-white hover:shadow-md hover:brightness-110 active:scale-[0.98]'
      )}
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {t("Ouvrir l'Accès Vendeur", 'Open Seller access')}
    </button>
  );
}
