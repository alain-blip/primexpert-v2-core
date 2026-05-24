/**
 * Dashboard GPS — Archiviste (péremption 24 mois) + Statisticien (médianes régionales).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Table2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMarketData } from '../../hooks/useMarketData';
import {
  DEFAULT_TEMPORAL_WINDOW,
  passesTemporalFilter,
  TRANSACTIONS_PAGE_SIZE,
  type MarketGpsRegionalSummary,
  type MarketGpsTransaction,
  type MarketTemporalWindow,
} from '@primexpert/core/market';

type GpsViewTab = 'comparables' | 'ratios';

function fmtMoney(n: number | undefined, locale: 'fr' | 'en'): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 });
}

function fmtPct(n: number | undefined, locale: 'fr' | 'en'): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const s = n.toFixed(1);
  return locale === 'fr' ? `${s.replace('.', ',')} %` : `${s} %`;
}

const TEMPORAL_OPTIONS: { value: MarketTemporalWindow; fr: string; en: string }[] = [
  { value: '12m', fr: 'Derniers 12 mois', en: 'Last 12 months' },
  { value: '24m', fr: 'Derniers 24 mois', en: 'Last 24 months' },
  { value: 'all', fr: 'Toutes les archives', en: 'All archives' },
];

export function MarketDataGrid({
  locale,
  brokerId,
  t,
}: {
  locale: 'fr' | 'en';
  brokerId?: string | null;
  t: (fr: string, en: string) => string;
}) {
  const {
    transactions,
    regionalSummaries,
    ratioSampleCount,
    loading,
    error,
    regions,
    totalTransactionCount,
    totalRegionCount,
  } = useMarketData(locale, brokerId);

  const [viewTab, setViewTab] = useState<GpsViewTab>('comparables');
  const [temporalWindow, setTemporalWindow] =
    useState<MarketTemporalWindow>(DEFAULT_TEMPORAL_WINDOW);
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [temporalWindow, regionFilter, viewTab]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((row) => {
      if (!passesTemporalFilter(row.sortMillis, temporalWindow)) return false;
      if (regionFilter !== 'all' && row.region !== regionFilter) return false;
      return true;
    });
  }, [transactions, temporalWindow, regionFilter]);

  const filteredSummaries = useMemo(() => {
    return regionalSummaries.filter((row) => {
      if (!passesTemporalFilter(row.sortMillis, temporalWindow)) return false;
      if (regionFilter !== 'all' && row.region !== regionFilter) return false;
      return true;
    });
  }, [regionalSummaries, temporalWindow, regionFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / TRANSACTIONS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filteredTransactions.slice(
    (safePage - 1) * TRANSACTIONS_PAGE_SIZE,
    safePage * TRANSACTIONS_PAGE_SIZE
  );

  const selectClass =
    'rounded-lg border-2 border-[#142c6a]/30 bg-white px-3 py-2 text-[11px] font-bold text-slate-900 shadow-sm focus:border-[#142c6a] focus:outline-none';

  const inArchiveMode = temporalWindow === 'all';

  return (
    <div className="rounded-xl border-2 border-white/20 bg-white p-4 sm:p-5 space-y-4 text-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-[#142c6a]" aria-hidden />
            <h2 className="text-base font-black text-[#142c6a]">
              {t('Consultation GPS — Big Data', 'GPS consultation — Big Data')}
            </h2>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            {loading
              ? t('Chargement des données compilées…', 'Loading compiled data…')
              : viewTab === 'comparables'
                ? t(
                    `${filteredTransactions.length} comparable(s) · fenêtre : ${TEMPORAL_OPTIONS.find((o) => o.value === temporalWindow)?.fr ?? '24 mois'} · ${totalTransactionCount} en base.`,
                    `${filteredTransactions.length} comparable(s) · window: ${TEMPORAL_OPTIONS.find((o) => o.value === temporalWindow)?.en ?? '24 months'} · ${totalTransactionCount} in database.`
                  )
                : t(
                    `${filteredSummaries.length} résumé(s) régional(aux) · ${ratioSampleCount} échantillons agrégés · ${totalRegionCount} régions.`,
                    `${filteredSummaries.length} regional summary(ies) · ${ratioSampleCount} aggregated samples · ${totalRegionCount} regions.`
                  )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              {t('Filtrer par région', 'Filter by region')}
            </span>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">{t('Toutes les régions', 'All regions')}</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              {t('Péremption temporelle', 'Temporal window')}
            </span>
            <select
              value={temporalWindow}
              onChange={(e) => setTemporalWindow(e.target.value as MarketTemporalWindow)}
              className={selectClass}
            >
              {TEMPORAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {locale === 'fr' ? opt.fr : opt.en}
                </option>
              ))}
            </select>
          </label>
          {!inArchiveMode ? (
            <button
              type="button"
              onClick={() => setTemporalWindow('all')}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-300 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-800 hover:bg-slate-100"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden />
              {t('Accéder aux archives', 'Open archives')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setTemporalWindow(DEFAULT_TEMPORAL_WINDOW)}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#142c6a]/40 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#142c6a] hover:bg-slate-50"
            >
              {t('Revenir aux 24 derniers mois', 'Back to last 24 months')}
            </button>
          )}
        </div>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-1"
        role="tablist"
        aria-label={t('Vues GPS', 'GPS views')}
      >
        {(
          [
            {
              id: 'comparables' as const,
              icon: MapPin,
              labelFr: 'Comparables de ventes',
              labelEn: 'Sale comparables',
            },
            {
              id: 'ratios' as const,
              icon: TrendingUp,
              labelFr: 'Analyses et ratios',
              labelEn: 'Analysis and ratios',
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={viewTab === tab.id}
              onClick={() => setViewTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition',
                viewTab === tab.id
                  ? 'bg-[#142c6a] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t(tab.labelFr, tab.labelEn)}
            </button>
          );
        })}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-red-900"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      {viewTab === 'comparables' ? (
        <ComparablesTable
          rows={pageRows}
          loading={loading}
          locale={locale}
          t={t}
          empty={!loading && filteredTransactions.length === 0}
        />
      ) : (
        <RegionalRatiosTable
          rows={filteredSummaries}
          loading={loading}
          locale={locale}
          t={t}
          empty={!loading && filteredSummaries.length === 0}
        />
      )}

      {viewTab === 'comparables' && !loading && filteredTransactions.length > 0 ? (
        <PaginationBar
          page={safePage}
          pageCount={pageCount}
          total={filteredTransactions.length}
          pageSize={TRANSACTIONS_PAGE_SIZE}
          onPage={setPage}
          locale={locale}
          t={t}
        />
      ) : null}
    </div>
  );
}

function ComparablesTable({
  rows,
  loading,
  locale,
  t,
  empty,
}: {
  rows: MarketGpsTransaction[];
  loading: boolean;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
  empty: boolean;
}) {
  return (
    <div className="relative overflow-auto rounded-xl border border-slate-200 shadow-inner max-h-[min(65vh,640px)]">
      <table className="min-w-[900px] w-full border-collapse text-[11px] text-slate-900">
        <thead className="sticky top-0 z-10 bg-[#142c6a] text-left text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
          <tr>
            <th className="px-3 py-3 min-w-[200px]">{t('Adresse / Ville', 'Address / City')}</th>
            <th className="px-3 py-3">{t('Région', 'Region')}</th>
            <th className="px-3 py-3 whitespace-nowrap">{t('Date', 'Date')}</th>
            <th className="px-3 py-3 text-right">{t('Prix de vente', 'Sale price')}</th>
            <th className="px-3 py-3 text-right">{t('Unités', 'Units')}</th>
            <th className="px-3 py-3 text-right">{t('Prix / unité', 'Price / unit')}</th>
            <th className="px-3 py-3 text-right">
              {t('Taux de capitalisation (TGA)', 'Capitalization rate (cap rate)')}
            </th>
            <th className="px-3 py-3 min-w-[120px]">{t('Source', 'Source')}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('Chargement…', 'Loading…')}
                </span>
              </td>
            </tr>
          ) : empty ? (
            <tr>
              <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                {t(
                  'Aucun comparable pour cette fenêtre. Élargissez la période ou téléversez un rapport dans l’onglet Ingestion.',
                  'No comparables for this window. Widen the period or upload a report in the Ingestion tab.'
                )}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  'border-t border-slate-100 hover:bg-slate-100/80 transition-colors',
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'
                )}
              >
                <td className="px-3 py-2.5 align-top">
                  <p className="font-semibold text-[#142c6a]">
                    {row.address || row.city}
                  </p>
                  {row.address ? (
                    <p className="text-slate-500 text-[10px]">{row.city}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 align-top text-slate-700">{row.region}</td>
                <td className="px-3 py-2.5 align-top tabular-nums whitespace-nowrap">
                  {row.date ?? '—'}
                </td>
                <td className="px-3 py-2.5 align-top text-right tabular-nums font-medium">
                  {fmtMoney(row.prixVente, locale)} $
                </td>
                <td className="px-3 py-2.5 align-top text-right tabular-nums">
                  {row.nbPortes ?? '—'}
                </td>
                <td className="px-3 py-2.5 align-top text-right tabular-nums font-medium">
                  {fmtMoney(row.prixParPorte, locale)} $
                </td>
                <td className="px-3 py-2.5 align-top text-right tabular-nums">
                  {row.tgaPct != null
                    ? locale === 'fr'
                      ? `${row.tgaPct.toFixed(2).replace('.', ',')} %`
                      : `${row.tgaPct.toFixed(2)} %`
                    : '—'}
                </td>
                <td
                  className="px-3 py-2.5 align-top text-slate-700 max-w-[200px] truncate"
                  title={row.source}
                >
                  {row.source}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function RegionalRatiosTable({
  rows,
  loading,
  locale,
  t,
  empty,
}: {
  rows: MarketGpsRegionalSummary[];
  loading: boolean;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
  empty: boolean;
}) {
  return (
    <div className="relative overflow-auto rounded-xl border border-slate-200 shadow-inner max-h-[min(65vh,640px)]">
      <table className="min-w-[880px] w-full border-collapse text-[11px] text-slate-900">
        <thead className="sticky top-0 z-10 bg-[#142c6a] text-left text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
          <tr>
            <th className="px-3 py-3">{t('Région', 'Region')}</th>
            <th className="px-3 py-3 text-right">
              {t("Ratio des dépenses d'exploitation (RDE) — médiane", 'Operating expense ratio — median')}
            </th>
            <th className="px-3 py-3 text-right">
              {t('Énergie — médiane ($/unité)', 'Energy — median ($/unit)')}
            </th>
            <th className="px-3 py-3 text-right">
              {t('Salaires — médiane ($/unité)', 'Salaries — median ($/unit)')}
            </th>
            <th className="px-3 py-3 text-right">
              {t('Entretien — médiane ($/unité)', 'Maintenance — median ($/unit)')}
            </th>
            <th className="px-3 py-3 text-center">{t('Échantillons', 'Samples')}</th>
            <th className="px-3 py-3 min-w-[160px]">{t('Indicateurs macro', 'Macro indicators')}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('Calcul des médianes régionales…', 'Computing regional medians…')}
                </span>
              </td>
            </tr>
          ) : empty ? (
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                {t(
                  'Aucun résumé régional pour cette fenêtre. Les ratios sont regroupés par région — pas de lignes individuelles.',
                  'No regional summary for this window. Ratios are grouped by region — no individual rows.'
                )}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  'border-t border-slate-100 hover:bg-slate-100/80 transition-colors',
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'
                )}
              >
                <td className="px-3 py-2.5 align-top font-semibold text-[#142c6a]">
                  {row.region}
                </td>
                <td className="px-3 py-2.5 align-top text-right tabular-nums font-bold">
                  {fmtPct(row.rdeMedianPct, locale)}
                </td>
                <td className="px-3 py-2.5 align-top text-right tabular-nums font-medium">
                  {row.energieMedianPerDoor != null
                    ? `${fmtMoney(row.energieMedianPerDoor, locale)} $`
                    : '—'}
                </td>
                <td className="px-3 py-2.5 align-top text-right tabular-nums font-medium">
                  {row.salairesMedianPerDoor != null
                    ? `${fmtMoney(row.salairesMedianPerDoor, locale)} $`
                    : '—'}
                </td>
                <td className="px-3 py-2.5 align-top text-right tabular-nums">
                  {row.entretienMedianPerDoor != null
                    ? `${fmtMoney(row.entretienMedianPerDoor, locale)} $`
                    : '—'}
                </td>
                <td className="px-3 py-2.5 align-top text-center tabular-nums text-slate-600">
                  {row.sampleCount}
                </td>
                <td className="px-3 py-2.5 align-top text-[10px] text-slate-600 leading-snug">
                  {row.macroHint ?? '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaginationBar({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  locale,
  t,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
      <p className="text-[10px] font-bold text-slate-600 tabular-nums">
        {t(
          `Lignes ${from}–${to} sur ${total} · ${pageSize} par page`,
          `Rows ${from}–${to} of ${total} · ${pageSize} per page`
        )}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-800 disabled:opacity-40 hover:bg-slate-50"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('Précédent', 'Previous')}
        </button>
        <span className="text-[10px] font-bold tabular-nums text-slate-700 px-2">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border-2 border-[#142c6a] bg-[#142c6a] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white disabled:opacity-40 hover:bg-[#0f2252]"
        >
          {t('Suivant', 'Next')}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
