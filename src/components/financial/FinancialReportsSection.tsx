/**
 * Rapports financiers PDF — section informative (Phase 3, lecture seule V2).
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

export function FinancialReportsSection() {
  const { t } = useLanguage();

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white px-6 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-slate-700" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#142c6a]">
          {t('Rapports certifiables', 'Certifiable reports')}
        </p>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">
        {t(
          'Les rapports vendeur, acheteur et banque (PDF) seront générés depuis cette section une fois le module d’export V2 branché. En attendant, utilisez l’onglet Documents pour les pièces justificatives.',
          'Seller, buyer, and lender PDF reports will be generated here once the V2 export module is wired. Until then, use the Documents tab for supporting files.'
        )}
      </p>
      <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
        <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          {t('Analyse vendeur & mise en marché', 'Seller listing analysis')}
        </li>
        <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          {t('Dossier acheteur', 'Buyer package')}
        </li>
        <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          {t('Mémo banque / financement', 'Lender memo')}
        </li>
      </ul>
    </section>
  );
}
