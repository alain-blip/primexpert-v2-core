/**
 * Espace de travail ACM — valorisation ancrée sur une résidence (SSOT).
 * TGA entièrement éditable avec recalcul instantané à la saisie.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  BadgeAlert,
  BookOpen,
  Sparkles,
  Lock,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatPopulationCount } from '@primexpert/core/market';
import { useLanguage } from '../../lib/i18n';
import { formatCurrency } from '../../lib/utils';
import {
  calculateValuation,
  DEFAULT_MARKET_BENCHMARKS,
  computeTgaAdjustment,
  runStressTests,
  buildValuationInputsFromAcmBootstrap,
  type ResidenceAcmBootstrap,
  type ValuationOutputs,
  type TgaAdjustmentResult,
} from '@primexpert/core/valuation';
import {
  selectSellerNarrative,
  type SellerNarrativeDecision,
  type ResidenceFinancials,
} from '@primexpert/core/narrative';
import {
  ACM_TOP3_TREND_KEYS,
  buildAcmCostTrendNarrativeBundle,
  computeAcmCostTrendPoints,
  type MarketGpsRatioSample,
  type MarketGpsTransaction,
} from '@primexpert/core/market';
import { AcmHistoricalTrendsSection } from './AcmHistoricalTrendsSection';
import type {
  CertifiableReportBrokerFooter,
  FinancialDataV2Doc,
} from '@primexpert/core/financial';
import type { Residence } from '../../services/residences';
import { downloadAcmVendorReportPdf } from '../../services/acmVendorPdfService';

const TGA_INPUT_CLASS =
  'w-full rounded-xl border-2 border-blue-300 bg-white px-4 py-3 text-base font-black text-[#142c6a] tabular-nums shadow-sm focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/40 outline-none transition';

function PositioningBadge({
  positioning,
  t,
}: {
  positioning: ValuationOutputs['pricePositioning'];
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const meta = {
    'sous-évalué': {
      Icon: TrendingDown,
      label: t('Sous-évalué', 'Underpriced'),
      color: 'bg-emerald-500/[0.08] text-emerald-300 border-emerald-400/30',
    },
    'bien-positionné': {
      Icon: CheckCircle2,
      label: t('Bien positionné', 'Well priced'),
      color: 'bg-blue-500/10 text-blue-300 border-blue-400/30',
    },
    surévalué: {
      Icon: TrendingUp,
      label: t('Surévalué', 'Overpriced'),
      color: 'bg-red-500/[0.08] text-red-300 border-red-400/30',
    },
  }[positioning];
  const Icon = meta.Icon;
  return (
    <motion.div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${meta.color}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </motion.div>
  );
}

function parseCapRateInput(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function fmtMoneyField(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return formatCurrency(value, { maxDecimals: 0 });
}

function fmtCountField(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—';
  return formatPopulationCount(Math.round(value));
}

export interface AcmValuationPdfExportContext {
  residenceId?: string;
  residenceAddress?: string;
  broker: CertifiableReportBrokerFooter;
  locale: 'fr' | 'en';
  financialData: FinancialDataV2Doc;
  residence: Residence;
}

export interface AcmValuationWorkspaceProps {
  bootstrap: ResidenceAcmBootstrap;
  onOpenComparables?: () => void;
  compact?: boolean;
  ratioSamples?: MarketGpsRatioSample[];
  transactions?: MarketGpsTransaction[];
  subjectExpenses?: Partial<Record<string, number>>;
  /** Contexte export CraftMyPDF — rapport vendeur (ACM). */
  pdfExport?: AcmValuationPdfExportContext;
}

export function AcmValuationWorkspace({
  bootstrap,
  onOpenComparables,
  compact = false,
  ratioSamples = [],
  transactions = [],
  subjectExpenses,
  pdfExport,
}: AcmValuationWorkspaceProps) {
  const { t, language } = useLanguage();
  const suggestedCapRatePct =
    Number.isFinite(bootstrap.suggestedCapRatePct) && bootstrap.suggestedCapRatePct > 0
      ? bootstrap.suggestedCapRatePct
      : bootstrap.targetCapRatePct;

  const [tgaInput, setTgaInput] = useState(() => String(suggestedCapRatePct));
  const [targetCapRatePct, setTargetCapRatePct] = useState(suggestedCapRatePct);
  /** TGA réellement appliqué au moteur (après ajustement pénétration). */
  const [effectiveCapRate, setEffectiveCapRate] = useState(suggestedCapRatePct / 100);
  const [penetrationRatePct, setPenetrationRatePct] = useState(bootstrap.penetrationRatePct);
  const [tgaManuallyAdjusted, setTgaManuallyAdjusted] = useState(false);
  const [result, setResult] = useState<ValuationOutputs | null>(null);
  const [tgaAdjustment, setTgaAdjustment] = useState<TgaAdjustmentResult | null>(null);
  const [recommendedPrice, setRecommendedPrice] = useState<number | null>(null);
  const [stressSummary, setStressSummary] = useState<{
    occ85: number;
    occ90: number;
    occ100: number;
  } | null>(null);
  const [narrative, setNarrative] = useState<SellerNarrativeDecision | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendorPdfPending, setVendorPdfPending] = useState(false);
  const [vendorPdfError, setVendorPdfError] = useState<string | null>(null);

  const bootstrapSyncKey = useMemo(
    () =>
      [
        bootstrap.residenceLabel,
        bootstrap.suggestedCapRatePct,
        bootstrap.revenuBrutEffectif,
        bootstrap.revenuNetExploitation,
        bootstrap.askingPrice,
        bootstrap.units,
        bootstrap.penetrationRatePct,
        bootstrap.marketContext.sectorUnits,
      ].join('|'),
    [bootstrap]
  );

  const lastBootstrapSyncRef = useRef('');

  useEffect(() => {
    if (lastBootstrapSyncRef.current === bootstrapSyncKey) return;
    lastBootstrapSyncRef.current = bootstrapSyncKey;
    setTgaInput(String(suggestedCapRatePct));
    setTargetCapRatePct(suggestedCapRatePct);
    setPenetrationRatePct(bootstrap.penetrationRatePct);
    setTgaManuallyAdjusted(false);
  }, [bootstrapSyncKey, suggestedCapRatePct, bootstrap.penetrationRatePct]);

  const runValuation = useCallback(
    (capPct: number, penPct: number) => {
      if (bootstrap.rneBlocksValuation) {
        setResult(null);
        setTgaAdjustment(null);
        setRecommendedPrice(null);
        setStressSummary(null);
        setError(
          language === 'fr'
            ? 'Valorisation bloquée : revenu net d’exploitation (RNE) incohérent avec le revenu brut effectif (RBE).'
            : 'Valuation blocked: net operating income (NOI) is inconsistent with effective gross income (EGI).'
        );
        return;
      }
      if (!Number.isFinite(capPct) || capPct <= 0) {
        setResult(null);
        setTgaAdjustment(null);
        setRecommendedPrice(null);
        setStressSummary(null);
        return;
      }
      setError(null);
      try {
        let adjustedCap = capPct / 100;
        let adj: TgaAdjustmentResult | null = null;
        if (penPct > 0) {
          adj = computeTgaAdjustment({
            baseTga: adjustedCap,
            tauxPenetrationRPA: penPct / 100,
            nombreUnites: bootstrap.units,
          });
          adjustedCap = adj.finalTga;
        }
        setTgaAdjustment(adj);
        setEffectiveCapRate(adjustedCap);

        const inputs = buildValuationInputsFromAcmBootstrap(bootstrap, {
          targetCapRate: adjustedCap,
          penetrationRatePct: penPct,
        });
        const out = calculateValuation(inputs);
        setResult(out);

        const vacancyRate = bootstrap.valuationInputs.vacancyRate;
        const occupancy = Math.max(0.01, 1 - vacancyRate);
        const stress = runStressTests(out.noiAccounting, occupancy, adjustedCap, {
          rbp: out.grossPotentialIncome,
          operatingExpenses: out.operatingExpensesTotal,
        });
        setStressSummary({
          occ85: stress.occ85.valueRange.min,
          occ90: stress.occ90.valueRange.min,
          occ100: stress.occ100.valueRange.min,
        });
        setRecommendedPrice(out.suggestedPrice);
      } catch (e) {
        console.error('[AcmValuationWorkspace]', e);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [bootstrap, language]
  );

  useEffect(() => {
    runValuation(targetCapRatePct, penetrationRatePct);
  }, [targetCapRatePct, penetrationRatePct, runValuation]);

  const costTrendNotes = useMemo(() => {
    if (!ratioSamples.length) return [];
    const points = computeAcmCostTrendPoints({
      ratioSamples,
      transactions,
      region: bootstrap.regionLabel ?? undefined,
      locale: language,
      units: bootstrap.units,
      subjectExpenses,
      metricKeys: [...ACM_TOP3_TREND_KEYS],
    });
    const bundle = buildAcmCostTrendNarrativeBundle(points, language);
    const global =
      language === 'fr' ? bundle.globalSummaryFr : bundle.globalSummaryEn;
    const bullets = language === 'fr' ? bundle.bulletsFr : bundle.bulletsEn;
    return global ? [global, ...bullets.slice(0, 3)] : bullets;
  }, [
    ratioSamples,
    transactions,
    bootstrap.regionLabel,
    bootstrap.units,
    language,
    subjectExpenses,
  ]);

  useEffect(() => {
    if (!result) {
      setNarrative(null);
      return;
    }
    let cancelled = false;
    setNarrativeLoading(true);

    const financials: ResidenceFinancials = {
      rbe: bootstrap.revenuBrutEffectif,
      noi: bootstrap.revenuNetExploitation,
      totalExpenses: result.operatingExpensesTotal,
      prixDemande: bootstrap.askingPrice,
    };

    selectSellerNarrative(
      financials,
      DEFAULT_MARKET_BENCHMARKS,
      { capRateMedian: effectiveCapRate, costTrendNotes },
      { narrativeMode: 'RULES' }
    )
      .then((decision) => {
        if (!cancelled) setNarrative(decision);
      })
      .catch(() => {
        if (!cancelled) setNarrative(null);
      })
      .finally(() => {
        if (!cancelled) setNarrativeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [result, bootstrap, effectiveCapRate, costTrendNotes]);

  const rneIntegrityIssue =
    language === 'fr' ? bootstrap.rneIntegrityIssueFr : bootstrap.rneIntegrityIssueEn;

  const capRateRationale =
    language === 'fr' ? bootstrap.capRateRationaleFr : bootstrap.capRateRationaleEn;

  const handleTgaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTgaInput(raw);
    const parsed = parseCapRateInput(raw);
    if (parsed == null) {
      setTgaManuallyAdjusted(true);
      setTargetCapRatePct(0);
      return;
    }
    setTargetCapRatePct(parsed);
    setTgaManuallyAdjusted(Math.abs(parsed - suggestedCapRatePct) > 0.04);
  };

  const resetTgaToMarket = () => {
    setTgaInput(String(suggestedCapRatePct));
    setTargetCapRatePct(suggestedCapRatePct);
    setTgaManuallyAdjusted(false);
  };

  const handleVendorReportPdf = useCallback(async () => {
    setVendorPdfError(null);
    if (!pdfExport) {
      setVendorPdfError(
        t(
          'Profil courtier requis pour générer le rapport.',
          'Broker profile required to generate the report.'
        )
      );
      return;
    }
    if (!result || bootstrap.rneBlocksValuation) {
      setVendorPdfError(
        t(
          'Valorisation complète requise (revenu net d’exploitation (RNE) valide).',
          'Complete valuation required (valid net operating income (NOI)).'
        )
      );
      return;
    }
    setVendorPdfPending(true);
    try {
      await downloadAcmVendorReportPdf({
        bootstrap,
        valuation: result,
        broker: pdfExport.broker,
        locale: pdfExport.locale,
        residenceId: pdfExport.residenceId,
        residenceAddress: pdfExport.residenceAddress,
        financialData: pdfExport.financialData,
        residence: pdfExport.residence,
        effectiveCapRate,
        recommendedPrice,
        sellerNarrative: narrative?.signedReading ?? null,
      });
    } catch (e) {
      console.error('[AcmValuationWorkspace] vendor PDF failed', e);
      const detail = e instanceof Error ? e.message : String(e);
      setVendorPdfError(
        t(
          `Échec de génération du rapport vendeur. (${detail})`,
          `Seller report generation failed. (${detail})`
        )
      );
    } finally {
      setVendorPdfPending(false);
    }
  }, [
    pdfExport,
    result,
    bootstrap,
    effectiveCapRate,
    recommendedPrice,
    narrative,
    t,
  ]);

  const ratios = useMemo(() => {
    if (!result) return null;
    return [
      {
        label: t('Taux de capitalisation implicite (TGA)', 'Implied capitalization rate (cap rate)'),
        value:
          result.capRateImpliedAtAsking !== undefined
            ? `${(result.capRateImpliedAtAsking * 100).toFixed(2)}%`
            : '—',
      },
      {
        label: t('Multiple du revenu brut réel (MRB)', 'Actual gross rent multiplier (GRM)'),
        value: result.actualMrbAtAsking.toFixed(2),
      },
      {
        label: t('Ratio de couverture du service de la dette (DSCR)', 'Debt service coverage ratio (DSCR)'),
        value: result.dscrAtAsking.toFixed(2),
      },
      {
        label: t('Revenu net d’exploitation comptable (RNE)', 'Accounting net operating income (NOI)'),
        value: formatCurrency(result.noiAccounting, { maxDecimals: 2 }),
      },
    ];
  }, [result, t]);

  const lockedFields = [
    { label: t('Propriété sujet', 'Subject property'), value: bootstrap.residenceLabel },
    { label: t('Région administrative', 'Administrative region'), value: bootstrap.regionLabel ?? '—' },
    {
      label: t('Classe RPA', 'RPA class'),
      value: bootstrap.assetClassLabel ?? '—',
    },
    { label: t('Nombre d’unités', 'Unit count'), value: String(bootstrap.units) },
    {
      label: t('Revenu brut effectif (RBE)', 'Effective gross income (EGI)'),
      value: formatCurrency(bootstrap.revenuBrutEffectif, { maxDecimals: 0 }),
    },
    {
      label: t('Revenu net d’exploitation (RNE)', 'Net operating income (NOI)'),
      value: formatCurrency(bootstrap.revenuNetExploitation, { maxDecimals: 0 }),
    },
    {
      label: t('Prix demandé ($)', 'Asking price ($)'),
      value: formatCurrency(bootstrap.askingPrice, { maxDecimals: 0 }),
    },
  ];

  return (
    <div className={compact ? 'space-y-6' : 'max-w-5xl mx-auto space-y-8'}>
      {!bootstrap.rneBlocksValuation && !bootstrap.rneIntegrityOk && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-amber-950"
        >
          <BadgeAlert className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em]">
              {t('Avertissement — revenu net d’exploitation (RNE)', 'Warning — net operating income (NOI)')}
            </p>
            <p className="text-[14px] leading-relaxed">
              {rneIntegrityIssue ??
                t(
                  'Complétez la grille Finances ou relancez l’extraction. La valorisation utilise les derniers montants connus.',
                  'Complete the Finance grid or re-run extraction. Valuation uses the last known amounts.'
                )}
            </p>
          </div>
        </div>
      )}

      {bootstrap.rneBlocksValuation && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border-2 border-red-500 bg-red-50 px-5 py-4 text-red-950"
        >
          <BadgeAlert className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em]">
              {t(
                'Erreur de cohérence financière — revenu net d’exploitation (RNE)',
                'Financial consistency error — net operating income (NOI)'
              )}
            </p>
            <p className="text-[14px] leading-relaxed">
              {rneIntegrityIssue ??
                t(
                  'Le revenu net d’exploitation (RNE) ne peut pas être égal ou supérieur au revenu brut effectif (RBE). Recalculez la grille Finances ou relancez l’extraction.',
                  'Net operating income (NOI) cannot equal or exceed effective gross income (EGI). Recalculate the Finance grid or re-run extraction.'
                )}
            </p>
            <p className="text-[12px] font-semibold tabular-nums">
              RBE {formatCurrency(bootstrap.revenuBrutEffectif, { maxDecimals: 0 })} · RNE{' '}
              {formatCurrency(bootstrap.revenuNetExploitation, { maxDecimals: 0 })}
            </p>
          </div>
        </div>
      )}
      <div className="bg-vault text-white p-6 rounded-[28px] shadow-[0_24px_70px_rgba(0,0,0,0.55)] relative overflow-hidden border border-white/10">
        <motion.div className="relative z-10 flex flex-col gap-6">
          <div className={compact ? 'flex flex-wrap items-center justify-between gap-3' : 'flex items-center justify-between'}>
            <div>
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                {t('Moteur Core · @primexpert/core/valuation', 'Core Engine · @primexpert/core/valuation')}
              </p>
              <h2
                className={
                  compact
                    ? 'text-2xl font-black italic tracking-tighter uppercase'
                    : 'text-4xl font-black italic tracking-tighter uppercase'
                }
              >
                {t('Analyse de mise en marché (ACM)', 'Market launch analysis (CMA)')}
                <span className="text-blue-500">{t('_OACIQ', '_OACIQ')}</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-100">
                {t('Données CRM · SSOT', 'CRM data · SSOT')}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-blue-300" aria-hidden />
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-300/80">
                {t('Données sujet verrouillées (financial/dataV2)', 'Locked subject data (financial/dataV2)')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lockedFields.map((f) => (
                <div key={f.label} className="space-y-1">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-blue-300/50">
                    {f.label}
                  </span>
                  <p className="text-sm font-bold text-white truncate" title={f.value}>
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="acm-target-cap-rate"
                  className="block text-[10px] font-black uppercase tracking-widest text-blue-300/60"
                >
                  {t('Taux de capitalisation cible (TGA) (%)', 'Target capitalization rate (cap rate) (%)')}
                </label>
                {tgaManuallyAdjusted ? (
                  <span className="rounded-full border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-200">
                    {t('Taux personnalisé par l’utilisateur', 'User-customized rate')}
                  </span>
                ) : null}
              </div>
              <input
                id="acm-target-cap-rate"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={tgaInput}
                onChange={handleTgaChange}
                className={TGA_INPUT_CLASS}
                aria-describedby="acm-tga-rationale"
              />
              {!tgaManuallyAdjusted && capRateRationale ? (
                <p id="acm-tga-rationale" className="text-[11px] leading-relaxed text-blue-200/90">
                  {capRateRationale}
                  {bootstrap.capRateSampleCount > 0 ? (
                    <span className="text-blue-300/60">
                      {' '}
                      · n={bootstrap.capRateSampleCount}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {tgaManuallyAdjusted ? (
                <button
                  type="button"
                  onClick={resetTgaToMarket}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-300 hover:text-blue-100 underline underline-offset-2"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t('Réinitialiser au TGA marché GPS', 'Reset to GPS market cap rate')}
                </button>
              ) : null}
            </div>
            <label className="space-y-2">
              <span className="block text-[10px] font-black uppercase tracking-widest text-blue-300/60">
                {t('Pénétration RPA 75+ (%) — ajustement TGA', 'RPA 75+ penetration (%) — cap rate adj.')}
              </span>
              <input
                type="number"
                step={0.1}
                value={penetrationRatePct}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setPenetrationRatePct(Number.isFinite(next) ? next : 0);
                }}
                className={TGA_INPUT_CLASS}
              />
            </label>
          </div>

          {onOpenComparables ? (
            <button
              type="button"
              onClick={onOpenComparables}
              className="text-left text-[11px] font-bold text-blue-300 hover:text-blue-200 underline underline-offset-2"
            >
              {t(
                'Sélectionner les comparables régionaux (onglet Marché)',
                'Select regional comparables (Market tab)'
              )}
            </button>
          ) : null}
        </motion.div>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/[0.08] px-5 py-3 text-[11px] font-semibold text-red-300">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {vendorPdfError ? (
        <p className="text-[13px] font-bold text-red-300" role="alert">
          {vendorPdfError}
        </p>
      ) : null}

      {pdfExport ? (
        <div className="flex flex-wrap justify-end">
          <button
            type="button"
            disabled={
              vendorPdfPending ||
              !result ||
              bootstrap.rneBlocksValuation ||
              bootstrap.revenuNetExploitation <= 0
            }
            onClick={handleVendorReportPdf}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-lg border-2 border-[#D4AF37] bg-[#D4AF37] px-5 py-2.5 text-[13px] font-black text-black hover:bg-[#c9a432] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            {vendorPdfPending
              ? t('Génération…', 'Generating…')
              : t('Générer le Rapport', 'Generate report')}
          </button>
        </div>
      ) : null}

      {ratioSamples.length > 0 && (
        <AcmHistoricalTrendsSection
          ratioSamples={ratioSamples}
          transactions={transactions}
          region={bootstrap.regionLabel}
          locale={language}
          units={bootstrap.units}
          subjectExpenses={subjectExpenses}
          t={t}
        />
      )}

      {result && bootstrap.revenuNetExploitation > 0 && !bootstrap.rneBlocksValuation ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-vault-bright p-10 rounded-[32px] border border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  {t('Prix suggéré (Core OACIQ)', 'Suggested price (OACIQ Core)')}
                </h3>
                <PositioningBadge positioning={result.pricePositioning} t={t} />
              </div>
              <p className="text-6xl font-black italic tracking-tighter text-slate-300 leading-none">
                {formatCurrency(result.suggestedPrice)}
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="p-5 bg-white/[0.03] rounded-xl border border-white/10">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {t('Plancher', 'Floor')}
                  </span>
                  <p className="font-mono text-sm font-black text-slate-300 mt-1">
                    {formatCurrency(result.suggestedLow)}
                  </p>
                </div>
                <div className="p-5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                    {t('Plafond', 'Ceiling')}
                  </span>
                  <p className="font-mono text-sm font-black text-blue-300 mt-1">
                    {formatCurrency(result.suggestedHigh)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-blue-500 text-white p-8 rounded-[32px] shadow-lg flex flex-col gap-5 relative overflow-hidden">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">
                {t('Valeur banquable', 'Bankable value')}
              </p>
              <p className="text-3xl font-black italic">{formatCurrency(result.bankableValue)}</p>
              <p className="text-[10px] font-mono text-blue-100/80">DSCR · {result.dscrAtAsking.toFixed(2)}</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ratios?.map((r) => (
              <div key={r.label} className="rounded-2xl border border-white/10 bg-vault-bright p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{r.label}</p>
                <p className="mt-2 text-xl font-black italic text-slate-300">{r.value}</p>
              </div>
            ))}
          </div>

          {tgaAdjustment ? (
            <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-5 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">
                {t('Ajustement TGA — pénétration & taille', 'Cap rate adjustment — penetration & size')}
              </p>
              <p className="text-sm font-bold text-white">
                {(tgaAdjustment.baseTga * 100).toFixed(2)} % → {(tgaAdjustment.finalTga * 100).toFixed(2)} %
              </p>
            </div>
          ) : null}

          {stressSummary && recommendedPrice != null ? (
            <div className="rounded-2xl border border-white/10 bg-vault-bright p-5 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {t('Scénarios d’occupation & prix recommandé', 'Occupancy scenarios & recommended price')}
              </p>
              <p className="text-xs text-slate-300">
                85 % : {formatCurrency(stressSummary.occ85)} · 90 % : {formatCurrency(stressSummary.occ90)} · 100 % :{' '}
                {formatCurrency(stressSummary.occ100)}
              </p>
              <p className="text-lg font-black text-emerald-300">
                {t('Prix recommandé (RNE ÷ TGA cible)', 'Recommended price (NOI ÷ target cap rate)')} :{' '}
                {formatCurrency(recommendedPrice)}
              </p>
            </div>
          ) : null}

          {result.warnings.length > 0 ? (
            <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/[0.08] p-6 space-y-3">
              <motion.div className="flex items-center gap-2">
                <BadgeAlert className="h-4 w-4 text-amber-400" />
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                  {t('Avertissements moteur', 'Engine warnings')}
                </p>
              </motion.div>
              <ul className="space-y-1.5">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-[12px] text-amber-300">
                    — {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <motion.div className="rounded-[28px] border border-white/10 bg-vault p-8">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="h-4 w-4 text-blue-300" />
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-300/70">
                {t('Lecture Vendeur', 'Seller reading')}
              </p>
              {narrative ? (
                <span className="ml-auto flex items-center gap-1 text-[9px] font-black uppercase text-blue-300">
                  <Sparkles className="h-3 w-3" />
                  {narrative.source}
                </span>
              ) : null}
            </div>
            {narrativeLoading ? (
              <p className="text-[11px] text-blue-300/70">{t('Génération…', 'Generating…')}</p>
            ) : narrative ? (
              <p className="text-[13px] leading-relaxed text-slate-200 whitespace-pre-wrap">{narrative.signedReading}</p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-amber-950">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] mb-1">
              {t('Données financières incomplètes', 'Incomplete financial data')}
            </p>
            <p className="text-[14px] leading-relaxed">
              {t(
                "⚠️ Les données financières sont incomplètes. Veuillez extraire et injecter les dépenses d'exploitation (OPEX) depuis l'onglet Finances pour générer la valorisation.",
                '⚠️ Financial data is incomplete. Please extract and inject operating expenses (OPEX) from the Finance tab to generate valuation.'
              )}
            </p>
          </div>

          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-vault-bright p-10 rounded-[32px] border border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  {t('Prix suggéré (Core OACIQ)', 'Suggested price (OACIQ Core)')}
                </h3>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-500/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                  {t('En attente', 'Pending')}
                </span>
              </div>
              <p className="text-6xl font-black italic tracking-tighter text-slate-400 leading-none">--- $</p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="p-5 bg-white/[0.03] rounded-xl border border-white/10">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {t('Plancher', 'Floor')}
                  </span>
                  <p className="font-mono text-sm font-black text-slate-300 mt-1">--- $</p>
                </div>
                <div className="p-5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                    {t('Plafond', 'Ceiling')}
                  </span>
                  <p className="font-mono text-sm font-black text-blue-300 mt-1">--- $</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-500 text-white p-8 rounded-[32px] shadow-lg flex flex-col gap-5 relative overflow-hidden">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">
                {t('Valeur banquable', 'Bankable value')}
              </p>
              <p className="text-3xl font-black italic">--- $</p>
              <p className="text-[10px] font-mono text-blue-100/80">DSCR · —</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              t('Taux de capitalisation implicite (TGA)', 'Implied capitalization rate (cap rate)'),
              t('Multiple du revenu brut réel (MRB)', 'Actual gross rent multiplier (GRM)'),
              t('Ratio de couverture du service de la dette (DSCR)', 'Debt service coverage ratio (DSCR)'),
              t('Revenu net d’exploitation comptable (RNE)', 'Accounting net operating income (NOI)'),
            ].map((label) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-vault-bright p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-black italic text-slate-300">
                  {t('En attente', 'Pending')}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
