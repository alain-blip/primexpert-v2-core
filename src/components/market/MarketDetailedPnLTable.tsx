/**
 * Tableau P&L détaillé — moyennes vs médianes (look comptable).
 */

import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  computeDetailedPnLForFilter,
  type DetailedPnLRow,
  type MarketGpsRatioSample,
  type MarketTemporalWindow,
} from '@primexpert/core/market';

function fmtMoney(n: number | undefined, locale: 'fr' | 'en'): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 });
}

function fmtPct(n: number | undefined, locale: 'fr' | 'en'): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const s = n.toFixed(1);
  return locale === 'fr' ? `${s.replace('.', ',')} %` : `${s} %`;
}

function fmtMinMax(
  min: number | undefined,
  max: number | undefined,
  locale: 'fr' | 'en',
  asPct = false
): string {
  if (min == null || max == null) return '—';
  if (asPct) {
    return `${fmtPct(min, locale)} – ${fmtPct(max, locale)}`;
  }
  return locale === 'fr'
    ? `${fmtMoney(min, locale)} $ – ${fmtMoney(max, locale)} $`
    : `${fmtMoney(min, locale)} $ – ${fmtMoney(max, locale)} $`;
}

function PnLRowCells({
  row,
  locale,
  t,
}: {
  row: DetailedPnLRow;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
}) {
  if (row.isRatioLine) {
    return (
      <>
        <td className="px-3 py-2 text-right tabular-nums text-slate-600 border-r border-slate-100">
          {row.sampleCount || '—'}
        </td>
        <td className="px-3 py-2 text-right tabular-nums border-r border-slate-100">—</td>
        <td className="px-3 py-2 text-right tabular-nums border-r border-slate-100">—</td>
        <td className="px-3 py-2 text-right tabular-nums text-[10px] border-r border-slate-100">
          {fmtMinMax(row.minPerUnit, row.maxPerUnit, locale, true)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          <span className="font-semibold text-[#142c6a]">{fmtPct(row.medianRatioPct, locale)}</span>
          {row.meanRatioPct != null ? (
            <span className="block text-[9px] font-normal text-slate-500">
              {t('moy.', 'mean')} {fmtPct(row.meanRatioPct, locale)}
            </span>
          ) : null}
        </td>
      </>
    );
  }

  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums text-slate-600 border-r border-slate-100">
        {row.sampleCount || '—'}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium border-r border-slate-100">
        {fmtMoney(row.meanPerUnit, locale)} $
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#142c6a] border-r border-slate-100">
        {fmtMoney(row.medianPerUnit, locale)} $
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-[10px] text-slate-600 border-r border-slate-100">
        {fmtMinMax(row.minPerUnit, row.maxPerUnit, locale)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span className="font-semibold text-slate-800">{fmtPct(row.pctRbeMedian, locale)}</span>
        {row.pctRbeMean != null ? (
          <span className="block text-[9px] font-normal text-slate-500">
            {t('moy.', 'mean')} {fmtPct(row.pctRbeMean, locale)}
          </span>
        ) : null}
      </td>
    </>
  );
}

export function MarketDetailedPnLTable({
  ratioSamples,
  regionFilter,
  temporalWindow,
  locale,
  loading,
  t,
}: {
  ratioSamples: MarketGpsRatioSample[];
  regionFilter: string;
  temporalWindow: MarketTemporalWindow;
  locale: 'fr' | 'en';
  loading: boolean;
  t: (fr: string, en: string) => string;
}) {
  const { rows, sampleCount, regionLabel } = computeDetailedPnLForFilter(ratioSamples, {
    region: regionFilter,
    temporalWindow,
  });

  const regionTitle =
    regionFilter === 'all'
      ? t('Toutes les régions (agrégé)', 'All regions (aggregated)')
      : regionLabel;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 gap-2 rounded-xl border border-slate-200 bg-white">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t('Construction du tableau P&L détaillé…', 'Building detailed P&L table…')}
      </div>
    );
  }

  const hasData = rows.some((r) => r.kind === 'line' || (r.kind === 'subtotal' && r.sampleCount > 0));
  if (!hasData) {
    return (
      <p className="py-12 text-center text-slate-500 text-sm rounded-xl border border-slate-200 bg-white">
        {t(
          'Aucune donnée P&L pour cette région et cette fenêtre. Téléversez un rapport dans l’onglet Ingestion.',
          'No P&L data for this region and window. Upload a report in the Ingestion tab.'
        )}
      </p>
    );
  }

  return (
    <section className="rounded-xl border-2 border-slate-300 bg-white shadow-sm overflow-hidden">
      <header className="border-b-2 border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {t('État des résultats détaillé', 'Detailed P&L statement')}
          </p>
          <h3 className="text-sm font-black text-[#142c6a]">{regionTitle}</h3>
        </div>
        <p className="text-[10px] font-bold tabular-nums text-slate-600">
          {sampleCount} {t('échantillons bruts', 'raw samples')}
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-[880px] w-full border-collapse text-[11px] text-slate-900">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-[#142c6a] text-[9px] font-black uppercase tracking-wider text-white">
              <th className="px-4 py-2.5 text-left border-r border-white/20 min-w-[200px]">
                {t('Poste', 'Line item')}
              </th>
              <th className="px-3 py-2.5 text-right border-r border-white/20 w-14">n</th>
              <th className="px-3 py-2.5 text-right border-r border-white/20 min-w-[96px]">
                {t('Moyenne ($ / unité)', 'Mean ($ / unit)')}
              </th>
              <th className="px-3 py-2.5 text-right border-r border-white/20 min-w-[96px]">
                {t('Médiane ($ / unité)', 'Median ($ / unit)')}
              </th>
              <th className="px-3 py-2.5 text-right border-r border-white/20 min-w-[112px]">
                {t('Fourchette min–max', 'Min–max range')}
              </th>
              <th className="px-3 py-2.5 text-right min-w-[88px]">
                {t('% du revenu brut effectif (RBE)', '% of effective gross income (EGI)')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const label = locale === 'fr' ? row.labelFr : row.labelEn;

              if (row.kind === 'section-header') {
                return (
                  <tr key={row.id} className="bg-slate-100 border-t-2 border-slate-300">
                    <td
                      colSpan={6}
                      className="px-4 py-2 font-black uppercase tracking-wide text-[#142c6a] text-[11px]"
                    >
                      {label}
                    </td>
                  </tr>
                );
              }

              if (row.kind === 'group-header') {
                return (
                  <tr key={row.id} className="bg-slate-50 border-t border-slate-200">
                    <td
                      colSpan={6}
                      className="px-4 py-1.5 pl-8 text-[10px] font-bold uppercase tracking-wide text-slate-700"
                    >
                      {label}
                    </td>
                  </tr>
                );
              }

              const isSubtotal = row.kind === 'subtotal';
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-t border-slate-200',
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80',
                    isSubtotal && 'bg-amber-50/70 font-bold border-t-slate-300'
                  )}
                >
                  <td
                    className={cn(
                      'px-4 py-2 border-r border-slate-100',
                      row.indent && 'pl-10',
                      isSubtotal && 'font-bold text-[#142c6a]'
                    )}
                  >
                    {label}
                  </td>
                  <PnLRowCells row={row} locale={locale} t={t} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-600">
        {t(
          'Comparez la moyenne et la médiane pour repérer les postes où une poignée de résidences tire la moyenne (ex. assurances, énergie).',
          'Compare mean and median to spot line items where a few properties skew the average (e.g. insurance, energy).'
        )}
      </footer>
    </section>
  );
}

