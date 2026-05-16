/**
 * Carte TP70 — contexte démographique (lecture seule).
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Info, Users } from 'lucide-react';
import {
  calculateTP70FromResidence,
  isDataStale,
  TP70_GLOSSARY,
  type TP70InterpretationCode,
} from '@primexpert/core/financial';
import { useLanguage } from '../../lib/i18n';

function tp70Color(code: TP70InterpretationCode | null): string {
  switch (code) {
    case 'UNDER_PENETRATED':
      return '#2e7d32';
    case 'MATURE':
      return '#f57c00';
    case 'AVERAGE':
      return '#1565c0';
    default:
      return '#6c757d';
  }
}

export interface TP70CardProps {
  residenceHints: Record<string, unknown>;
}

export function TP70Card({ residenceHints }: TP70CardProps) {
  const { t, language } = useLanguage();
  const tp70 = useMemo(() => calculateTP70FromResidence(residenceHints), [residenceHints]);
  const stale = isDataStale(tp70.refYear);
  const color = tp70Color(tp70.interpretationCode);

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white px-6 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-violet-600" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#000000]">
          {language === 'fr' ? TP70_GLOSSARY.labelFr : TP70_GLOSSARY.label}
        </p>
        {tp70.confidenceTier === 'low' && (
          <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-800">
            {t('Estimation', 'Estimate')}
          </span>
        )}
        {stale && tp70.confidenceTier !== 'low' && (
          <span className="rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-blue-800">
            {t('À rafraîchir', 'Refresh suggested')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1 flex items-center gap-1">
            {TP70_GLOSSARY.labelFr}
            <Info className="h-3 w-3" title={TP70_GLOSSARY.definition} />
          </p>
          <p className="text-3xl font-black tracking-tight text-[#000000]" style={{ color: tp70.tp70 != null ? color : '#6c757d' }}>
            {tp70.tp70Label}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            {tp70.regionName || t('Région inconnue', 'Unknown region')}
            {tp70.refYear ? ` · Réf. ${tp70.refYear}` : ''}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1">
            {t('Référence Québec', 'Quebec benchmark')}
          </p>
          <p className="text-2xl font-black text-[#000000]">{tp70.benchmarkLabel}</p>
          {tp70.interpretation ? (
            <div
              className="mt-3 rounded-xl border px-3 py-2 text-sm font-medium"
              style={{
                color,
                borderColor: `${color}40`,
                backgroundColor: `${color}12`,
              }}
            >
              {tp70.interpretation}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600 italic flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t(
                'Données régionales insuffisantes pour interprétation',
                'Insufficient regional data for interpretation'
              )}
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-[10px] text-slate-500 italic">
        {t('Source', 'Source')}:{' '}
        {tp70.source
          ? `${tp70.source.population} / ${tp70.source.supply}`
          : t('Non disponible', 'Not available')}
        {' · '}
        {TP70_GLOSSARY.disclaimer ?? TP70_GLOSSARY.interpretation}
      </p>
    </section>
  );
}
