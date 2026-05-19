/**
 * Ratios de performance — lecture seule (Hub Finance).
 * Charte institutionnelle : fond clair, tableaux blancs, valeurs en noir.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Percent } from 'lucide-react';
import {
  computePerformanceRatiosViewModel,
  type PerformanceRatioRow,
  type RatioDisplayKind,
} from '@primexpert/core/financial';
import {
  formatCurrency as formatCurrencyCore,
  formatPercent,
} from '@primexpert/core/utils/formatting';
import { useLanguage } from '../../lib/i18n';
import { useFinancialData } from '../../context/FinancialDataContext';
import { ProvenanceStrip } from './ProvenanceStrip';
import type { Residence } from '../../services/residences';

function formatRatioValue(
  value: number | null,
  kind: RatioDisplayKind,
  locale: string
): string {
  if (value == null || !Number.isFinite(value)) return '—';

  switch (kind) {
    case 'currency':
    case 'currencyPerUnit':
      return formatCurrencyCore(value, { fallback: '—' });
    case 'multiplier':
      return `${value.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}×`;
    case 'percent':
      return formatPercent(value, 1);
    default:
      return String(value);
  }
}

function RatioTable({
  title,
  rows,
  language,
}: {
  title: string;
  rows: PerformanceRatioRow[];
  language: 'fr' | 'en';
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden font-sans">
      <header className="px-5 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#142c6a]">
          {title}
        </h3>
      </header>
      <div className="overflow-x-auto bg-white">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-wider text-slate-600 border-b border-slate-200 bg-slate-50">
              <th className="px-5 py-2.5 font-bold">Code</th>
              <th className="px-5 py-2.5 font-bold">
                {language === 'fr' ? 'Indicateur' : 'Metric'}
              </th>
              <th className="px-5 py-2.5 font-bold text-right">
                {language === 'fr' ? 'Valeur' : 'Value'}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td className="px-5 py-3 font-mono text-[11px] font-black text-[#142c6a] whitespace-nowrap">
                  {row.code}
                </td>
                <td className="px-5 py-3">
                  <p className="font-semibold text-[#142c6a]">
                    {language === 'fr' ? row.labelFr : row.labelEn}
                  </p>
                  {(language === 'fr' ? row.definitionFr : row.definitionEn) && (
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {language === 'fr' ? row.definitionFr : row.definitionEn}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-base font-black text-[#142c6a] tabular-nums whitespace-nowrap">
                  {formatRatioValue(
                    row.value,
                    row.displayKind,
                    language === 'fr' ? 'fr-CA' : 'en-CA'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export interface PerformanceRatiosTabProps {
  residence: Residence;
}

export function PerformanceRatiosTab({ residence }: PerformanceRatiosTabProps) {
  const { t, language } = useLanguage();
  const { financialData, loading, error, isInProvider } = useFinancialData();
  const lang = language === 'fr' ? 'fr' : 'en';
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';

  const residenceHints = useMemo(
    () =>
      ({
        ...residence,
        prixDemande: residence.price,
        askingPrice: residence.price,
      }) as Record<string, unknown>,
    [residence]
  );

  const model = useMemo(
    () => computePerformanceRatiosViewModel(financialData, residenceHints),
    [financialData, residenceHints]
  );

  if (!isInProvider) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        {t('Provider financier manquant.', 'Financial provider missing.')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-16 text-center font-sans">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
          {t('Chargement des ratios…', 'Loading ratios…')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
        {t('Erreur Firestore', 'Firestore error')}: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans text-slate-800">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <Percent className="h-5 w-5 text-slate-700 shrink-0" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#142c6a]">
            {t('Ratios de performance', 'Performance ratios')}
          </p>
          <p className="text-[10px] text-slate-600 font-mono mt-0.5">
            {t('Source', 'Source')}: {model.source} · {t('Lecture seule', 'Read-only')}
          </p>
        </div>
      </div>

      {model.incomplete && (
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-[#142c6a]">
            {t(
              'Données financières de l’inscription incomplètes pour certains ratios (prix ou revenu brut effectif (RBE) manquant).',
              'Listing financial data incomplete for some ratios (missing price or effective gross income (EGI)).'
            )}
          </p>
        </div>
      )}

      <ProvenanceStrip
        lastUpdated={
          (financialData as { lastUpdated?: unknown; updatedAt?: unknown } | null)?.lastUpdated ??
          (financialData as { updatedAt?: unknown } | null)?.updatedAt
        }
        source={model.source}
        confidenceTier={model.incomplete ? 'validation_required' : 'medium'}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ['prixDemande', t('Prix demandé', 'Asking price'), 'currency'],
            ['rbe', t('Revenu brut effectif (RBE)', 'Effective gross income (EGI)'), 'currency'],
            ['rne', t('Revenu net d’exploitation (RNE)', 'Net operating income (NOI)'), 'currency'],
            ['nombreUnitesTotal', t('Unités', 'Units'), 'unit'],
          ] as const
        ).map(([key, label, kind]) => {
          const raw = model.inputs[key];
          const display =
            kind === 'unit'
              ? raw != null
                ? String(raw)
                : '—'
              : formatRatioValue(raw, 'currency', locale);
          return (
            <div
              key={key}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-[9px] font-bold uppercase text-slate-600">{label}</p>
              <p className="text-lg font-black text-[#142c6a] tabular-nums mt-1">{display}</p>
            </div>
          );
        })}
      </div>

      <RatioTable
        title={t('Ratios de performance', 'Performance ratios')}
        rows={model.performanceRows}
        language={lang}
      />

      <RatioTable
        title={t('Mise de fonds et financement', 'Equity & financing')}
        rows={model.financingRows}
        language={lang}
      />
    </div>
  );
}
