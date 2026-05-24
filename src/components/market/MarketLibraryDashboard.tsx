/**
 * Statistiques du marché — Vault global, extraction omnivore Vertex AI + HITL adaptatif.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import {
  institutionalPanelSubtitleClass,
  institutionalPanelTitleClass,
} from '../../lib/institutionalTheme';
import {
  injectMarketMacroStatsViaCallable,
  parseMarketDocumentNow,
  subscribeMarketDocuments,
  uploadMarketDocument,
} from '../../services/marketDocumentsService';
import type { MarketDocumentRecord } from '../../types/marketDocument';
import {
  getMacroRegions,
  parseMasterMarketExtraction,
  type ComparableTransactionRow,
  type MarketReportRegionRow,
  type OperationalBenchmarkRow,
} from '@primexpert/core/documents';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(ms: number, locale: 'fr' | 'en'): string {
  return new Date(ms).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function fmtMoney(n: number | null | undefined, locale: 'fr' | 'en'): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 });
}

function parsingLabel(status: MarketDocumentRecord['parsingStatus'], locale: 'fr' | 'en'): string {
  const fr: Record<MarketDocumentRecord['parsingStatus'], string> = {
    not_applicable: 'Non applicable',
    pending: 'En attente d’analyse',
    completed: 'Analyse terminée',
    failed: 'Échec analyse',
    verified: 'Validé — données injectées',
  };
  const en: Record<MarketDocumentRecord['parsingStatus'], string> = {
    not_applicable: 'Not applicable',
    pending: 'Awaiting analysis',
    completed: 'Analysis complete',
    failed: 'Analysis failed',
    verified: 'Validated — data injected',
  };
  return locale === 'fr' ? fr[status] : en[status];
}

function RegionValidationCard({
  region,
  checked,
  onToggle,
  locale,
}: {
  region: MarketReportRegionRow;
  checked: boolean;
  onToggle: () => void;
  locale: 'fr' | 'en';
}) {
  const label = region.regionDisplayName ?? region.regionAdministrative;
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 transition',
        checked
          ? 'border-[#142c6a] bg-amber-50/60 ring-1 ring-[#142c6a]/20'
          : 'border-slate-200 bg-white hover:border-slate-300'
      )}
    >
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 accent-[#142c6a]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#142c6a]">{label}</p>
          <p className="text-[10px] font-mono text-slate-500">{region.regionAdministrative}</p>
        </div>
      </div>
      {region.coutRemplacementNeuf ? (
        <p className="text-[11px] text-slate-700">
          {locale === 'fr' ? 'Coût remplacement neuf' : 'Replacement cost'} :{' '}
          <span className="font-bold tabular-nums">
            {fmtMoney(region.coutRemplacementNeuf.montant, locale)} $/
            {region.coutRemplacementNeuf.unite === 'pi2' ? 'pi²' : region.coutRemplacementNeuf.unite}
          </span>
        </p>
      ) : null}
      {region.nouvellesUnitesEnChantier != null ? (
        <p className="text-[11px] text-slate-700">
          {locale === 'fr' ? 'Unités en chantier' : 'Units under construction'} :{' '}
          <span className="font-bold tabular-nums">{region.nouvellesUnitesEnChantier}</span>
        </p>
      ) : null}
    </label>
  );
}

function TransactionsGrid({
  rows,
  checked,
  onToggle,
  locale,
  t,
}: {
  rows: ComparableTransactionRow[];
  checked: Set<string>;
  onToggle: (rowId: string) => void;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-[11px] text-slate-900">
        <thead className="bg-slate-50 text-left text-slate-700">
          <tr>
            <th className="px-2 py-2 w-8" />
            <th className="px-2 py-2">{t('Adresse / Ville', 'Address / City')}</th>
            <th className="px-2 py-2">{t('Date', 'Date')}</th>
            <th className="px-2 py-2 text-right">{t('Prix', 'Price')}</th>
            <th className="px-2 py-2 text-right">{t('Portes', 'Doors')}</th>
            <th className="px-2 py-2 text-right">{t('Prix/porte', 'Price/door')}</th>
            <th className="px-2 py-2 text-right">{t('Taux de capitalisation (TGA)', 'Capitalization rate (cap rate)')}</th>
            <th className="px-2 py-2">{t('Vendeur', 'Seller')}</th>
            <th className="px-2 py-2">{t('Acheteur', 'Buyer')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowId} className="border-t border-slate-100 hover:bg-slate-50/80">
              <td className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={checked.has(row.rowId)}
                  onChange={() => onToggle(row.rowId)}
                  className="h-4 w-4 accent-[#142c6a]"
                />
              </td>
              <td className="px-2 py-2">
                <p className="font-semibold text-[#142c6a]">{row.adresse ?? row.ville}</p>
                {row.adresse ? <p className="text-slate-500">{row.ville}</p> : null}
              </td>
              <td className="px-2 py-2 tabular-nums text-slate-900">{row.dateTransaction ?? '—'}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-900">{fmtMoney(row.prixVente, locale)} $</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-900">{row.nbPortes ?? '—'}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-900">{fmtMoney(row.prixParPorte, locale)} $</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                {row.tgaPct != null ? `${row.tgaPct.toFixed(2).replace('.', ',')} %` : '—'}
              </td>
              <td className="px-2 py-2 max-w-[8rem] truncate text-slate-900">{row.vendeur ?? '—'}</td>
              <td className="px-2 py-2 max-w-[8rem] truncate text-slate-900">{row.acheteur ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BenchmarksGrid({
  rows,
  checked,
  onToggle,
  locale,
  t,
}: {
  rows: OperationalBenchmarkRow[];
  checked: Set<string>;
  onToggle: (rowId: string) => void;
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-[11px] text-slate-900">
        <thead className="bg-slate-50 text-left text-slate-700">
          <tr>
            <th className="px-2 py-2 w-8" />
            <th className="px-2 py-2">{t('Poste / ratio', 'Line / ratio')}</th>
            <th className="px-2 py-2">{t('Région', 'Region')}</th>
            <th className="px-2 py-2 text-right">{t('Ratio (%)', 'Ratio (%)')}</th>
            <th className="px-2 py-2 text-right">{t('Montant / porte', 'Amount / door')}</th>
            <th className="px-2 py-2 text-right">{t('Montant annuel', 'Annual amount')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowId} className="border-t border-slate-100 hover:bg-slate-50/80">
              <td className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={checked.has(row.rowId)}
                  onChange={() => onToggle(row.rowId)}
                  className="h-4 w-4 accent-[#142c6a]"
                />
              </td>
              <td className="px-2 py-2 font-semibold text-[#142c6a]">{row.label}</td>
              <td className="px-2 py-2 text-slate-900">{row.regionAdministrative ?? '—'}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                {row.ratioPct != null ? `${row.ratioPct.toFixed(1).replace('.', ',')} %` : '—'}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-900">{fmtMoney(row.montantParPorte, locale)} $</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-900">{fmtMoney(row.montantAnnuel, locale)} $</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketLibraryDashboard() {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<MarketDocumentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedRegions, setCheckedRegions] = useState<Set<string>>(new Set());
  const [checkedTransactions, setCheckedTransactions] = useState<Set<string>>(new Set());
  const [checkedBenchmarks, setCheckedBenchmarks] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    return subscribeMarketDocuments(profile.uid, setDocs);
  }, [profile?.uid]);

  const selectedDoc = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? docs[0] ?? null,
    [docs, selectedId]
  );

  const parsed = useMemo(
    () => (selectedDoc ? parseMasterMarketExtraction(selectedDoc.extractedData) : null),
    [selectedDoc]
  );

  const macroRegions = useMemo(() => (parsed ? getMacroRegions(parsed) : []), [parsed]);
  const transactions = parsed?.comparableTransactions ?? [];
  const benchmarks = parsed?.operationalBenchmarks ?? [];

  useEffect(() => {
    setCheckedRegions(new Set(macroRegions.map((r) => r.regionAdministrative)));
    setCheckedTransactions(new Set(transactions.map((r) => r.rowId)));
    setCheckedBenchmarks(new Set(benchmarks.map((r) => r.rowId)));
  }, [selectedDoc?.id, macroRegions, transactions, benchmarks]);

  const selectionCount =
    checkedRegions.size + checkedTransactions.size + checkedBenchmarks.size;

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!profile?.uid || !files?.length) return;
      setError(null);
      setSuccess(null);
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const created = await uploadMarketDocument(profile.uid, file);
          setSelectedId(created.id);
          setParsing(true);
          try {
            await parseMarketDocumentNow(created.id);
          } finally {
            setParsing(false);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setUploading(false);
      }
    },
    [profile?.uid]
  );

  const handleReparse = useCallback(async () => {
    if (!selectedDoc) return;
    setError(null);
    setParsing(true);
    try {
      await parseMarketDocumentNow(selectedDoc.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }, [selectedDoc]);

  const handleInject = useCallback(async () => {
    if (!selectedDoc || !parsed) return;
    const selectedRegionRows = macroRegions.filter((r) =>
      checkedRegions.has(r.regionAdministrative)
    );
    const selectedTx = transactions.filter((r) => checkedTransactions.has(r.rowId));
    const selectedBench = benchmarks.filter((r) => checkedBenchmarks.has(r.rowId));

    if (!selectedRegionRows.length && !selectedTx.length && !selectedBench.length) {
      setError(t('Cochez au moins une donnée à conserver.', 'Check at least one item to keep.'));
      return;
    }

    setError(null);
    setSuccess(null);
    setInjecting(true);
    try {
      const result = await injectMarketMacroStatsViaCallable({
        documentId: selectedDoc.id,
        selectedRegions: selectedRegionRows,
        selectedTransactions: selectedTx,
        selectedOperationalBenchmarks: selectedBench,
      });
      setSuccess(
        t(
          `${result.transactionsNewCount} nouvelles transactions ajoutées, ${result.transactionsDuplicateCount} doublons ignorés.` +
            (result.macroNewCount + result.macroDuplicateCount > 0
              ? ` · ${result.macroNewCount} macro ajoutées, ${result.macroDuplicateCount} macro en doublon.`
              : '') +
            (result.benchmarksNewCount + result.benchmarksDuplicateCount > 0
              ? ` · ${result.benchmarksNewCount} ratios ajoutés, ${result.benchmarksDuplicateCount} ratios en doublon.`
              : ''),
          `${result.transactionsNewCount} new transactions added, ${result.transactionsDuplicateCount} duplicates skipped.` +
            (result.macroNewCount + result.macroDuplicateCount > 0
              ? ` · ${result.macroNewCount} macro added, ${result.macroDuplicateCount} macro duplicates.`
              : '') +
            (result.benchmarksNewCount + result.benchmarksDuplicateCount > 0
              ? ` · ${result.benchmarksNewCount} ratios added, ${result.benchmarksDuplicateCount} ratio duplicates.`
              : '')
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInjecting(false);
    }
  }, [
    selectedDoc,
    parsed,
    macroRegions,
    transactions,
    benchmarks,
    checkedRegions,
    checkedTransactions,
    checkedBenchmarks,
    t,
  ]);

  return (
    <section className="rounded-2xl bg-primexpert-blue p-6 space-y-6">
      <header className="px-1">
        <h1 className={institutionalPanelTitleClass}>
          {t('Statistiques du marché', 'Market statistics')}
        </h1>
        <p className={institutionalPanelSubtitleClass}>
          {t(
            'Extraction omnivore — macro-économie, transactions, ratios. Persona statisticien immobilier (Vertex AI), validation humaine, alimentation ACM.',
            'Omnivore extraction — macro, transactions, ratios. Real estate statistician persona (Vertex AI), human validation, CMA feed.'
          )}
        </p>
      </header>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleUpload(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition',
          dragOver
            ? 'border-primexpert-gold bg-white/20'
            : 'border-white/50 bg-white/10 hover:bg-white/15'
        )}
      >
        <Upload className="h-8 w-8 text-white/90" aria-hidden />
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
          {t(
            'Glisser-déposer tout PDF marché (Altus, Côté Mercier, évaluation, ACM…)',
            'Drop any market PDF (Altus, Côté Mercier, appraisal, CMA…)'
          )}
        </p>
        {uploading || parsing ? (
          <span className="inline-flex items-center gap-2 text-[10px] text-white/90">
            <Loader2 className="h-4 w-4 animate-spin" />
            {uploading
              ? t('Téléversement…', 'Uploading…')
              : t(
                  'Analyse de données massives en cours (peut prendre jusqu’à 3 minutes)…',
                  'Large dataset analysis in progress (may take up to 3 minutes)…'
                )}
          </span>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => void handleUpload(e.target.files)}
        />
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-red-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      {success ? (
        <div role="status" className="flex items-start gap-2 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-sm">{success}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
        <aside className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/80 px-1">
            {t('Documents déposés', 'Uploaded documents')}
          </p>
          {docs.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-white/30 px-4 py-8 text-center text-[10px] font-bold uppercase tracking-widest text-white/60">
              {t('Aucun document', 'No documents yet')}
            </p>
          ) : (
            docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedId(doc.id)}
                className={cn(
                  'w-full rounded-xl border-2 px-3 py-3 text-left transition',
                  selectedDoc?.id === doc.id
                    ? 'border-primexpert-gold bg-white text-[#142c6a]'
                    : 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                )}
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate">{doc.fileName}</p>
                    <p className="text-[9px] opacity-70 mt-0.5">
                      {formatSize(doc.sizeBytes)} · {formatDate(doc.uploadedAtMillis, locale)}
                    </p>
                    <p className="text-[9px] font-bold uppercase mt-1 opacity-80">
                      {parsingLabel(doc.parsingStatus, locale)}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </aside>

        <div className="rounded-xl border-2 border-white/20 bg-white p-5 min-h-[360px] text-slate-900">
          {!selectedDoc ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-400 gap-3">
              <BarChart3 className="h-10 w-10" />
              <p className="text-sm font-medium">
                {t('Sélectionnez ou déposez un document.', 'Select or drop a document.')}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-base font-black text-[#142c6a]">{selectedDoc.fileName}</h2>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {parsingLabel(selectedDoc.parsingStatus, locale)}
                    {selectedDoc.parsingError ? ` — ${selectedDoc.parsingError}` : ''}
                  </p>
                </div>
                {selectedDoc.parsingStatus !== 'verified' ? (
                  <button
                    type="button"
                    disabled={parsing}
                    onClick={() => void handleReparse()}
                    className="rounded-lg border-2 border-[#142c6a] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#142c6a] hover:bg-slate-50 disabled:opacity-50"
                  >
                    {parsing ? t('Analyse…', 'Analyzing…') : t('Relancer analyse', 'Re-run analysis')}
                  </button>
                ) : null}
              </div>

              {parsed ? (
                <>
                  <p className="text-[11px] text-slate-600">
                    <span className="font-bold">{parsed.documentType}</span>
                    {parsed.sourcePublisher ? ` · ${parsed.sourcePublisher}` : ''}
                    {parsed.anneeDonnees ? ` · ${parsed.anneeDonnees}` : ''}
                  </p>

                  {macroRegions.length > 0 ? (
                    <section className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {t('Tendances macro — régions', 'Macro trends — regions')}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {macroRegions.map((region) => (
                          <RegionValidationCard
                            key={region.regionAdministrative}
                            region={region}
                            locale={locale}
                            checked={checkedRegions.has(region.regionAdministrative)}
                            onToggle={() =>
                              setCheckedRegions((prev) => {
                                const next = new Set(prev);
                                if (next.has(region.regionAdministrative)) next.delete(region.regionAdministrative);
                                else next.add(region.regionAdministrative);
                                return next;
                              })
                            }
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {transactions.length > 0 ? (
                    <section className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {t('Grille des transactions', 'Transactions grid')}
                      </p>
                      <TransactionsGrid
                        rows={transactions}
                        checked={checkedTransactions}
                        onToggle={(id) =>
                          setCheckedTransactions((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          })
                        }
                        locale={locale}
                        t={t}
                      />
                    </section>
                  ) : null}

                  {benchmarks.length > 0 ? (
                    <section className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {t('Grille des ratios', 'Ratios grid')}
                      </p>
                      <BenchmarksGrid
                        rows={benchmarks}
                        checked={checkedBenchmarks}
                        onToggle={(id) =>
                          setCheckedBenchmarks((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          })
                        }
                        locale={locale}
                        t={t}
                      />
                    </section>
                  ) : null}

                  {selectedDoc.parsingStatus !== 'verified' ? (
                    <button
                      type="button"
                      disabled={injecting || selectionCount === 0}
                      onClick={() => void handleInject()}
                      className="w-full rounded-xl bg-[#142c6a] px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white hover:bg-[#0f2252] disabled:opacity-50"
                    >
                      {injecting
                        ? t('Injection en cours…', 'Injecting…')
                        : t('Valider et alimenter les statistiques', 'Validate and feed market statistics')}
                    </button>
                  ) : (
                    <p className="text-center text-[11px] font-bold text-emerald-800">
                      {t('Document validé et injecté.', 'Document validated and injected.')}
                    </p>
                  )}
                </>
              ) : selectedDoc.parsingStatus === 'completed' || selectedDoc.parsingStatus === 'failed' ? (
                <p className="text-sm text-amber-800">
                  {t(
                    'Aucune donnée extraite — relancez l’analyse ou vérifiez le PDF.',
                    'No data extracted — re-run analysis or check the PDF.'
                  )}
                </p>
              ) : (
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('Analyse en cours…', 'Analysis in progress…')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
