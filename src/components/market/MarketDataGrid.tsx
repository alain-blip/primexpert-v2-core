/**
 * Dashboard GPS — outil d'évaluation financière (comparables + état des résultats régional).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronRight as RowChevron,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Table2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMarketData } from '../../hooks/useMarketData';
import { MarketComparablesCsvToolbar } from './MarketComparablesCsvToolbar';
import { MarketTransactionDrawer } from './MarketTransactionDrawer';
import { MarketGpsKpiCards } from './MarketGpsKpiCards';
import { MarketCharts } from './MarketCharts';
import { MarketSourceTag } from './MarketSourceTag';
import { MarketDetailedPnLTable } from './MarketDetailedPnLTable';
import { MarketTrendCharts } from './MarketTrendCharts';
import {
  computeMarketGpsDashboardMetrics,
  DEFAULT_TEMPORAL_WINDOW,
  passesTemporalFilter,
  TRANSACTIONS_PAGE_SIZE,
  coerceToGpsFilterRegion,
  type MarketGpsTransaction,
  type MarketTemporalWindow,
} from '@primexpert/core/market';

type GpsViewTab = 'comparables' | 'financial-stats';

function fmtMoney(n: number | undefined, locale: 'fr' | 'en'): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 });
}

function fmtPctNum(n: number | undefined, locale: 'fr' | 'en'): string {
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
    regionalPlStatements,
    ratioSamples,
    loading,
    error,
    regions,
    totalTransactionCount,
  } = useMarketData(locale, brokerId);

  const [viewTab, setViewTab] = useState<GpsViewTab>('comparables');
  const [temporalWindow, setTemporalWindow] =
    useState<MarketTemporalWindow>(DEFAULT_TEMPORAL_WINDOW);
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<MarketGpsTransaction | null>(null);

  useEffect(() => {
    setPage(1);
  }, [temporalWindow, regionFilter, viewTab]);

  const matchesRegionFilter = (region: string, city?: string) =>
    regionFilter === 'all' || coerceToGpsFilterRegion(region, city) === regionFilter;

  const filteredTransactions = useMemo(() => {
    return transactions.filter((row) => {
      if (!passesTemporalFilter(row.sortMillis, temporalWindow)) return false;
      if (!matchesRegionFilter(row.region, row.city)) return false;
      return true;
    });
  }, [transactions, temporalWindow, regionFilter]);

  const filteredPl = useMemo(() => {
    return regionalPlStatements.filter((row) => {
      if (!passesTemporalFilter(row.sortMillis, temporalWindow)) return false;
      if (!matchesRegionFilter(row.region)) return false;
      return true;
    });
  }, [regionalPlStatements, temporalWindow, regionFilter]);

  const filteredRatioSamples = useMemo(() => {
    return ratioSamples.filter((row) => {
      if (!passesTemporalFilter(row.sortMillis, temporalWindow)) return false;
      if (!matchesRegionFilter(row.region)) return false;
      return true;
    });
  }, [ratioSamples, temporalWindow, regionFilter]);

  const regionOnlyRatioSamples = useMemo(() => {
    return ratioSamples.filter((row) => matchesRegionFilter(row.region));
  }, [ratioSamples, regionFilter]);

  const regionOnlyTransactions = useMemo(() => {
    return transactions.filter((row) => matchesRegionFilter(row.region, row.city));
  }, [transactions, regionFilter]);

  const dashboardMetrics = useMemo(
    () => computeMarketGpsDashboardMetrics(filteredTransactions, filteredPl),
    [filteredTransactions, filteredPl]
  );

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / TRANSACTIONS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filteredTransactions.slice(
    (safePage - 1) * TRANSACTIONS_PAGE_SIZE,
    safePage * TRANSACTIONS_PAGE_SIZE
  );

  const selectClass =
    'rounded-lg border-2 border-[#142c6a]/30 bg-white px-3 py-2 text-[11px] font-bold text-slate-900 shadow-sm focus:border-[#142c6a] focus:outline-none';

  const inArchiveMode = temporalWindow === 'all';
  const windowLabel =
    TEMPORAL_OPTIONS.find((o) => o.value === temporalWindow)?.fr ?? '24 mois';
  const windowLabelEn =
    TEMPORAL_OPTIONS.find((o) => o.value === temporalWindow)?.en ?? '24 months';

  return (
    <div className="rounded-xl border-2 border-white/20 bg-white p-4 sm:p-5 space-y-4 text-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-[#142c6a]" aria-hidden />
            <h2 className="text-base font-black text-[#142c6a]">
              {t('Statistiques du marché', 'Market statistics')}
            </h2>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            {loading
              ? t('Chargement des données compilées…', 'Loading compiled data…')
              : viewTab === 'comparables'
                ? t(
                    `${filteredTransactions.length} comparables (fenêtre ${windowLabel}) · ${totalTransactionCount} en base`,
                    `${filteredTransactions.length} comparables (${windowLabelEn} window) · ${totalTransactionCount} in database`
                  )
                : t(
                      `${filteredRatioSamples.length} postes dans la fenêtre · historique complet pour tendances`,
                      `${filteredRatioSamples.length} line items in window · full history for trends`
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

      <GpsViewTabs viewTab={viewTab} setViewTab={setViewTab} t={t} />

      {!loading && !error ? (
        <>
          <MarketGpsKpiCards metrics={dashboardMetrics} locale={locale} t={t} />
          {viewTab === 'comparables' ? (
            <MarketCharts metrics={dashboardMetrics} locale={locale} t={t} />
          ) : null}
        </>
      ) : null}

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
        <>
          <MarketComparablesCsvToolbar
            locale={locale}
            brokerId={brokerId}
            transactions={transactions}
            filteredTransactions={filteredTransactions}
            t={t}
          />
          <ComparablesTable
            rows={pageRows}
            loading={loading}
            locale={locale}
            t={t}
            empty={!loading && filteredTransactions.length === 0}
            onRowClick={setSelectedTx}
          />
          {!loading && filteredTransactions.length > 0 ? (
            <PaginationBar
              page={safePage}
              pageCount={pageCount}
              total={filteredTransactions.length}
              pageSize={TRANSACTIONS_PAGE_SIZE}
              onPage={setPage}
              t={t}
            />
          ) : null}
        </>
      ) : (
        <div className="space-y-6">
          <MarketTrendCharts
            ratioSamples={regionOnlyRatioSamples}
            transactions={regionOnlyTransactions}
            regionFilter={regionFilter}
            locale={locale}
            t={t}
          />
          <MarketDetailedPnLTable
            ratioSamples={filteredRatioSamples}
            regionFilter={regionFilter}
            temporalWindow={temporalWindow}
            locale={locale}
            loading={loading}
            t={t}
          />
        </div>
      )}

      <MarketTransactionDrawer
        transaction={selectedTx}
        locale={locale}
        t={t}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
}

function GpsViewTabs({
  viewTab,
  setViewTab,
  t,
}: {
  viewTab: GpsViewTab;
  setViewTab: (v: GpsViewTab) => void;
  t: (fr: string, en: string) => string;
}) {
  return (
    <div
      className="sticky top-0 z-20 -mx-4 sm:-mx-5 px-4 sm:px-5 py-2 bg-white/95 backdrop-blur-sm border-y border-slate-200 shadow-sm"
      role="tablist"
      aria-label={t('Vues GPS', 'GPS views')}
    >
      <div className="flex flex-wrap gap-2">
      {(
        [
          {
            id: 'comparables' as const,
            icon: MapPin,
            labelFr: '1. Comparables de ventes',
            labelEn: '1. Sale comparables',
          },
          {
            id: 'financial-stats' as const,
            icon: FileSpreadsheet,
            labelFr: '2. Statistiques Financières',
            labelEn: '2. Financial Statistics',
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
    </div>
  );
}

function ComparablesTable({
  rows,
  loading,
  locale,
  t,
  empty,
  onRowClick,
}: {
  rows: MarketGpsTransaction[];
  loading: boolean;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
  empty: boolean;
  onRowClick: (row: MarketGpsTransaction) => void;
}) {
  return (
    <div className="relative overflow-auto rounded-xl border border-slate-200 shadow-inner max-h-[min(65vh,640px)]">
      <table className="min-w-[980px] w-full border-collapse text-[11px] text-slate-900">
        <thead className="sticky top-0 z-10 bg-[#142c6a] text-left text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
          <tr>
            <th className="px-2 py-3 w-6" aria-hidden />
            <th className="px-3 py-3 whitespace-nowrap">{t('Source', 'Source')}</th>
            <th className="px-3 py-3 min-w-[180px]">{t('Adresse / Ville', 'Address / City')}</th>
            <th className="px-3 py-3">{t('Région', 'Region')}</th>
            <th className="px-3 py-3 whitespace-nowrap">{t('Date', 'Date')}</th>
            <th className="px-3 py-3 whitespace-nowrap">{t('Année constr.', 'Year built')}</th>
            <th className="px-3 py-3 text-right">{t('Prix de vente', 'Sale price')}</th>
            <th className="px-3 py-3 text-right">{t('Unités', 'Units')}</th>
            <th className="px-3 py-3 text-right">{t('Prix / unité', 'Price / unit')}</th>
            <th className="px-3 py-3 text-right">
              {t('Taux de capitalisation (TGA)', 'Capitalization rate (cap rate)')}
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={10} className="px-4 py-16 text-center text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('Chargement…', 'Loading…')}
                </span>
              </td>
            </tr>
          ) : empty ? (
            <tr>
              <td colSpan={10} className="px-4 py-16 text-center text-slate-500">
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
                role="button"
                tabIndex={0}
                onClick={() => onRowClick(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick(row);
                  }
                }}
                className={cn(
                  'border-t border-slate-100 hover:bg-[#142c6a]/5 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#142c6a]/40',
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'
                )}
              >
                <td className="px-2 py-2.5 text-slate-400">
                  <RowChevron className="h-3.5 w-3.5" aria-hidden />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <MarketSourceTag
                    sourceDocumentName={row.sourceDocumentName}
                    source={row.source}
                    sourceDocumentId={row.sourceDocumentId}
                  />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <p className="font-semibold text-[#142c6a]">{row.address || row.city}</p>
                  {row.address ? <p className="text-slate-500 text-[10px]">{row.city}</p> : null}
                </td>
                <td className="px-3 py-2.5 align-top text-slate-700">{row.region}</td>
                <td className="px-3 py-2.5 align-top tabular-nums whitespace-nowrap">
                  {row.date ?? '—'}
                </td>
                <td className="px-3 py-2.5 align-top tabular-nums text-center font-medium">
                  {row.anneeConstruction ?? '—'}
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
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[10px] text-slate-500 border-t border-slate-100 bg-slate-50">
        {t(
          'Cliquez une ligne pour ouvrir la fiche complète (vendeur, acheteur, document source).',
          'Click a row to open the full sheet (seller, buyer, source document).'
        )}
      </p>
    </div>
  );
}


function PaginationBar({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  t,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
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
