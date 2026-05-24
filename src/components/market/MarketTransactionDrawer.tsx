/**
 * Fiche transaction — panneau latéral (master-detail Dashboard GPS).
 */

import { FileText, X } from 'lucide-react';
import type { MarketGpsTransaction } from '@primexpert/core/market';

function fmtMoney(n: number | undefined, locale: 'fr' | 'en'): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 });
}

export function MarketTransactionDrawer({
  transaction,
  locale,
  t,
  onClose,
}: {
  transaction: MarketGpsTransaction | null;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
  onClose: () => void;
}) {
  if (!transaction) return null;

  const fields: { label: string; value: string }[] = [
    { label: t('Adresse', 'Address'), value: transaction.address || transaction.city || '—' },
    { label: t('Ville', 'City'), value: transaction.city || '—' },
    { label: t('Région administrative', 'Administrative region'), value: transaction.region },
    { label: t('Date de transaction', 'Transaction date'), value: transaction.date ?? '—' },
    {
      label: t('Année de construction', 'Year built'),
      value: transaction.anneeConstruction != null ? String(transaction.anneeConstruction) : '—',
    },
    { label: t('Prix de vente', 'Sale price'), value: `${fmtMoney(transaction.prixVente, locale)} $` },
    {
      label: t('Unités', 'Units'),
      value: transaction.nbPortes != null ? String(transaction.nbPortes) : '—',
    },
    { label: t('Prix / unité', 'Price / unit'), value: `${fmtMoney(transaction.prixParPorte, locale)} $` },
    {
      label: t('Taux de capitalisation (TGA)', 'Capitalization rate (cap rate)'),
      value:
        transaction.tgaPct != null
          ? locale === 'fr'
            ? `${transaction.tgaPct.toFixed(2).replace('.', ',')} %`
            : `${transaction.tgaPct.toFixed(2)} %`
          : '—',
    },
    { label: t('Vendeur', 'Seller'), value: transaction.vendeur ?? '—' },
    { label: t('Acheteur', 'Buyer'), value: transaction.acheteur ?? '—' },
    { label: t("Type d'immeuble", 'Property type'), value: transaction.typeImmeuble ?? '—' },
    {
      label: t('Document source (PDF)', 'Source document (PDF)'),
      value: transaction.sourceDocumentName ?? transaction.source ?? '—',
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/40" aria-hidden onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-drawer-title"
        className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-md flex-col border-l-4 border-[#142c6a] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {t('Fiche de la transaction', 'Transaction sheet')}
            </p>
            <h3 id="tx-drawer-title" className="text-base font-black text-[#142c6a] mt-1 leading-snug">
              {transaction.address || transaction.city}
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">{transaction.region}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
            aria-label={t('Fermer', 'Close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {fields.map((f) => (
            <div key={f.label} className="border-b border-slate-100 pb-2.5 last:border-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{f.label}</p>
              <p className="text-[13px] font-semibold text-slate-900 mt-0.5 leading-snug">{f.value}</p>
            </div>
          ))}
          {transaction.sourceDocumentName ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 mt-2">
              <FileText className="h-4 w-4 text-[#142c6a] shrink-0" aria-hidden />
              <p className="text-[11px] font-medium text-slate-800 truncate">
                {transaction.sourceDocumentName}
              </p>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function motionlessField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 pb-2.5 last:border-0">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-[13px] font-semibold text-slate-900 mt-0.5 leading-snug">{value}</p>
    </div>
  );
}

function motionlessBackdrop({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-[70] bg-black/40" aria-hidden onClick={onClose} />;
}
