/**
 * Revenus & Dépenses — Grille CPA 3 colonnes (Déclaré | Marché | Normalisé).
 * SSOT calculs : buildRevenusDepensesGrid + computeRevenusDepensesLiveKpis.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Coins, Info, Loader2, Sparkles } from 'lucide-react';
import {
  buildNormalizationSuggestions,
  buildRevenusDepensesGrid,
  computeRevenusDepensesLiveKpis,
} from '@primexpert/core/financial';
import { formatCurrency as formatCurrencyCore } from '@primexpert/core/utils/formatting';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { useFinanceHubLock } from '../../../context/FinanceHubLockContext';
import { useGlobalFinancialBenchmark } from '../../../hooks/useGlobalFinancialBenchmark';
import { useInstitutionalToast } from '../../../hooks/useInstitutionalToast';
import {
  expenseAdjustmentsDraftFromFinancial,
  saveExpenseAdjustmentsToFinancial,
  type ExpenseAdjustmentsDraft,
} from '../../../services/financialDataService';
import { ProvenanceStrip } from '../../financial/ProvenanceStrip';
import {
  inst,
  InstitutionalKpi,
  InstitutionalPageHeader,
} from '../institutional/InstitutionalUi';
import type { Residence } from '../../../services/residences';

export interface RevenusDepensesTabProps {
  residence: Residence;
}

function fmt(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? formatCurrencyCore(n, { fallback: '—' }) : '—';
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(2).replace('.', ',')} %`;
}

function draftToOverride(draft: ExpenseAdjustmentsDraft): Record<string, unknown> {
  return { ...draft.byKey, autresDepenses: draft.autresDepenses };
}

function parseDraftNum(v: string | number | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function RevenusDepensesTab({ residence }: RevenusDepensesTabProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { financialData, loading, error, isInProvider, residenceId } = useFinancialData();
  const { inputsLocked } = useFinanceHubLock();
  const globalBm = useGlobalFinancialBenchmark(Boolean(residenceId && isInProvider));
  const { showSuccess, showError } = useInstitutionalToast();

  const [draft, setDraft] = useState<ExpenseAdjustmentsDraft>({ byKey: {}, autresDepenses: [] });
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const residenceHints = useMemo(
    () => ({
      ...residence,
      prixDemande: residence.price,
      askingPrice: residence.price,
    }),
    [residence]
  );

  useEffect(() => {
    setDraft(expenseAdjustmentsDraftFromFinancial(financialData));
  }, [financialData]);

  const grid = useMemo(
    () =>
      buildRevenusDepensesGrid(financialData, residenceHints, {
        expenseAdjustmentsOverride: draftToOverride(draft),
        portfolioBenchmark: {
          medians: globalBm.medians,
          thresholdFactor: globalBm.thresholdFactor,
        },
      }),
    [financialData, residenceHints, draft, globalBm.medians, globalBm.thresholdFactor]
  );

  const nombreUnites =
    (financialData?.calculatedResults?.nombreUnites as number | undefined) ??
    residence.nicheMetadata?.rpaFields?.units ??
    residence.nicheMetadata?.plexFields?.units ??
    null;

  const suggestions = useMemo(() => {
    const declaredByKey: Record<string, number> = {};
    for (const row of grid.rows) {
      if (row.kind === 'standard') declaredByKey[row.key] = row.declared;
    }
    return buildNormalizationSuggestions({
      rbe: grid.rbe ?? 0,
      nombreUnites,
      declaredByKey,
    });
  }, [grid.rows, grid.rbe, nombreUnites]);

  const liveKpis = useMemo(
    () =>
      computeRevenusDepensesLiveKpis(
        grid.rbe,
        grid.depensesNormaliseesTotal,
        residence.price ?? null,
        financialData?.calculatedResults?.tauxCapitalisation as number | null | undefined
      ),
    [grid.rbe, grid.depensesNormaliseesTotal, residence.price, financialData?.calculatedResults]
  );

  const persistDraft = useCallback(
    async (nextDraft: ExpenseAdjustmentsDraft) => {
      if (!residenceId || !financialData || inputsLocked) return;
      setSaving(true);
      try {
        await saveExpenseAdjustmentsToFinancial(residenceId, financialData, nextDraft);
        showSuccess(locale === 'fr' ? 'Normalisations enregistrées' : 'Normalizations saved');
      } catch (e) {
        showError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [residenceId, financialData, inputsLocked, locale, showSuccess, showError]
  );

  const scheduleSave = useCallback(
    (nextDraft: ExpenseAdjustmentsDraft) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void persistDraft(nextDraft);
      }, 900);
    },
    [persistDraft]
  );

  const setNormalizedForRow = useCallback(
    (rowKey: string, kind: 'standard' | 'autre', index: number | undefined, normalizedRaw: string) => {
      const normalized = parseDraftNum(normalizedRaw);
      setDraft((prev) => {
        const row = grid.rows.find(
          (r) => r.key === rowKey && (kind !== 'autre' || r.index === index)
        );
        if (!row) return prev;
        const adjustment = normalized - row.declared;
        const next = { ...prev, byKey: { ...prev.byKey }, autresDepenses: [...prev.autresDepenses] };
        if (kind === 'standard') {
          next.byKey[rowKey] = adjustment !== 0 ? String(adjustment) : '';
        } else if (index != null) {
          next.autresDepenses[index] = adjustment !== 0 ? String(adjustment) : '';
        }
        scheduleSave(next);
        return next;
      });
    },
    [grid.rows, scheduleSave]
  );

  const applySuggestion = useCallback(
    (expenseKey: string, suggestedNormalized: number) => {
      setNormalizedForRow(expenseKey, 'standard', undefined, String(suggestedNormalized));
    },
    [setNormalizedForRow]
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  if (!isInProvider) {
    return <div className={inst.alertAmber}>{t('Provider financier manquant.', 'Financial provider missing.')}</div>;
  }

  if (loading) {
    return (
      <div className={inst.loading}>
        <p className={inst.loadingText}>
          {t(
            'Chargement de la grille comptable professionnel agréé (CPA)…',
            'Loading chartered professional accountant (CPA) grid…'
          )}
        </p>
      </div>
    );
  }

  if (error) {
    return <div className={inst.alertRed}>{error.message}</div>;
  }

  if (!grid.hasFinancials || grid.rows.length === 0) {
    return (
      <div className={cn(inst.section, 'p-6')}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
          <div>
            <p className={inst.pageTitle}>{t('Revenus & Dépenses', 'Revenue & expenses')}</p>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              {t(
                'Aucune grille financial/dataV2 pour cette fiche. Téléversez des états financiers ou complétez la grille sur Copilote.',
                'No financial/dataV2 grid for this file. Upload statements or complete the grid in Copilote.'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'space-y-5 relative',
        inst.page,
        inputsLocked && 'pointer-events-none select-none opacity-90'
      )}
      aria-disabled={inputsLocked || undefined}
    >
      <InstitutionalPageHeader
        icon={<Coins className="h-5 w-5 text-slate-700 shrink-0" />}
        title={t(
          'Normalisation financière — Revenus et dépenses',
          'Financial normalization — Revenue and expenses'
        )}
        meta={
          globalBm.loading
            ? t('Benchmark marché…', 'Market benchmark…')
            : globalBm.error
              ? t('Réf. sectorielle (repli)', 'Sector reference (fallback)')
              : t(
                  `Benchmark portefeuille · ${globalBm.summary?.dossierCount ?? 0} dossiers`,
                  `Portfolio benchmark · ${globalBm.summary?.dossierCount ?? 0} files`
                )
        }
      />

      <ProvenanceStrip
        lastUpdated={grid.provenance.lastUpdated}
        source={grid.provenance.source}
        confidenceTier={grid.provenance.confidenceTier}
        coveragePercent={grid.provenance.coveragePercent}
      />

      {suggestions.length > 0 ? (
        <section className={cn(inst.section, 'p-4 space-y-2')}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
            {t(
              'Suggestions de normalisation (validation courtier)',
              'Normalization suggestions (broker validation)'
            )}
          </p>
          {suggestions.map((s) => (
            <div
              key={s.ruleId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#142c6a]">
                  {locale === 'fr' ? s.labelFr : s.labelEn}
                </p>
                <p className="text-[11px] text-slate-700 mt-0.5">
                  {locale === 'fr' ? s.explanationFr : s.explanationEn}
                </p>
              </div>
              {s.expenseKey && s.suggestedNormalized != null ? (
                <button
                  type="button"
                  disabled={inputsLocked}
                  onClick={() => applySuggestion(s.expenseKey!, s.suggestedNormalized!)}
                  className="shrink-0 rounded-lg border border-[#D4AF37]/60 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#142c6a] hover:bg-amber-50"
                >
                  {t('Appliquer', 'Apply')} {fmt(s.suggestedNormalized)}
                </button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className={inst.section}>
        <div className={inst.tableWrap}>
          <table className={cn(inst.table, 'min-w-[880px]')}>
            <thead>
              <tr>
                <th className={inst.th}>{t('Poste', 'Line item')}</th>
                <th className={inst.thRight}>{t('Déclaré (vendeur)', 'Declared (seller)')}</th>
                <th className={inst.thRight}>{t('Marché (benchmark)', 'Market (benchmark)')}</th>
                <th className={inst.thRight}>{t('Normalisé (courtier)', 'Normalized (broker)')}</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    inst.tr,
                    row.isPrimary && 'bg-slate-50',
                    row.vendorBelowMarket && 'bg-amber-50/60'
                  )}
                >
                  <td className={inst.td}>
                    <div className="flex items-start gap-1.5">
                      {row.vendorBelowMarket ? (
                        <span
                          title={
                            locale === 'fr'
                              ? 'Dépense déclarée anormalement basse vs marché (> 15 %)'
                              : 'Declared expense abnormally low vs market (> 15%)'
                          }
                        >
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5"
                            aria-hidden
                          />
                        </span>
                      ) : null}
                      {row.isPrimary ? <span className="text-[#D4AF37]">★</span> : null}
                      <span className="font-semibold text-[#142c6a]">{row.label}</span>
                    </div>
                    {row.vendorBelowMarket ? (
                      <p className="text-[10px] text-amber-800 mt-0.5 font-medium">
                        {t('Écart marché — vérifier et normaliser', 'Market gap — review and normalize')}
                      </p>
                    ) : null}
                  </td>
                  <td className={inst.tdValueMono}>{fmt(row.declared)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-xs font-bold tabular-nums text-[#142c6a]">
                      {fmt(row.marketAmount)}
                    </span>
                    {row.marketRefPct != null ? (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {fmtPct(row.marketRefPct)} {t('du RBE', 'of EGI')}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={inputsLocked}
                      value={row.normalized !== 0 ? String(Math.round(row.normalized)) : ''}
                      placeholder="—"
                      onChange={(e) =>
                        setNormalizedForRow(row.key, row.kind, row.index, e.target.value)
                      }
                      className={cn(
                        'w-full max-w-[8rem] ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1.5',
                        'text-right font-mono text-xs font-bold tabular-nums text-[#142c6a]',
                        'focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40'
                      )}
                      aria-label={`${row.label} — ${t('Normalisé', 'Normalized')}`}
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={3} className="px-4 py-3 font-bold text-[#142c6a]">
                  {t('Total dépenses normalisées', 'Total normalized expenses')}
                </td>
                <td className="px-3 py-3 text-right font-black text-[#142c6a] tabular-nums">
                  {fmt(grid.depensesNormaliseesTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-[#142c6a]/15 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
            {t('Indicateurs live (colonne Normalisé)', 'Live indicators (Normalized column)')}
          </p>
          {saving ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('Enregistrement…', 'Saving…')}
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <InstitutionalKpi
            label={t('Revenu brut effectif (RBE)', 'Effective gross income (EGI)')}
            value={fmt(liveKpis.rbe)}
          />
          <InstitutionalKpi
            label={t('Dépenses normalisées', 'Normalized expenses')}
            value={fmt(liveKpis.depensesNormalisees)}
          />
          <InstitutionalKpi
            label={t("Revenu net d'exploitation (RNE)", 'Net operating income (NOI)')}
            value={fmt(liveKpis.rne)}
          />
          <InstitutionalKpi
            label={t('Taux de capitalisation (TGA)', 'Capitalization rate (cap rate)')}
            value={fmtPct(liveKpis.tgaPct)}
          />
        </div>
        <p className={cn(inst.note, 'mt-3')}>
          {t(
            "Seule la colonne « Normalisé » alimente le revenu net d'exploitation (RNE) et le taux de capitalisation (TGA). Les suggestions restent indicatives — validation humaine obligatoire.",
            'Only the « Normalized » column feeds net operating income (NOI) and cap rate. Suggestions are indicative — human validation required.'
          )}
        </p>
      </section>
    </div>
  );
}
