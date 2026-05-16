import React from 'react';
import { Sparkles } from 'lucide-react';
import type { MsssEnrichmentMeta } from '@primexpert/core/identity';

export interface MsssEnrichmentBannerProps {
  show: boolean;
  msss: MsssEnrichmentMeta;
  language: 'fr' | 'en';
}

export function MsssEnrichmentBanner({ show, msss, language }: MsssEnrichmentBannerProps) {
  if (!show) return null;

  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  return (
    <div className="rounded-xl border border-violet-300/60 bg-violet-50 px-4 py-3 flex items-start gap-3">
      <Sparkles className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-[#000000]">
          {t(
            'Données extractibles — Registre officiel du MSSS',
            'Extractable data — Official MSSS registry'
          )}
        </p>
        <p className="mt-1 text-xs text-slate-700 leading-relaxed">
          {t(
            'Raphaël ✨ peut compléter la capacité, la structure juridique ou les installations techniques à partir du registre MSSS. Les champs marqués ✨ sont vides ou non confirmés alors qu’un enrichissement MSSS est disponible sur cette fiche.',
            'Raphael ✨ can fill capacity, legal structure, or building systems from the MSSS registry. Fields marked ✨ are empty or unconfirmed while MSSS enrichment is available on this file.'
          )}
        </p>
        {(msss.lastEnrichedLabel || msss.numeroRegistre) && (
          <p className="mt-2 text-[10px] font-mono text-slate-500">
            {msss.numeroRegistre ? `Registre ${msss.numeroRegistre}` : ''}
            {msss.lastEnrichedLabel
              ? `${msss.numeroRegistre ? ' · ' : ''}${t('Dernier enrichissement', 'Last enriched')}: ${msss.lastEnrichedLabel}`
              : ''}
            {msss.source ? ` · ${msss.source}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
