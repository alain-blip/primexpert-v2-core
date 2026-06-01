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
  TerritorialAcmMedians,
} from '@primexpert/core/financial';
import {
  computeCapitalizedValueFromRneAndTga,
  normalizeTgaPct,
  normalizeTgaRatio,
} from '@primexpert/core/financial';
import type { Residence } from '../../services/residences';
import { downloadAcmVendorReportPdf } from '../../services/acmVendorPdfService';
import {
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
  institutionalListingsInlineInputClass,
  institutionalListingsSecondaryButtonClass,
} from '../../lib/institutionalTheme';

const TGA_INPUT_CLASS = `${institutionalListingsInlineInputClass} text-base font-black tabular-nums text-black`;
const ACM_METRIC_VALUE_CLASS = 'font-black text-black dark:text-slate-900 tabular-nums';
const ACM_METRIC_LABEL_CLASS =
  'text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-primexpert-dark';

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
      color: 'bg-emerald-50 text-emerald-900 border-emerald-400 dark:bg-emerald-100',
    },
    'bien-positionné': {
      Icon: CheckCircle2,
      label: t('Bien positionné', 'Well priced'),
      color: 'bg-blue-50 text-blue-900 border-blue-400 dark:bg-blue-100',
    },
    surévalué: {
      Icon: TrendingUp,
      label: t('Surévalué', 'Overpriced'),
      color: 'bg-red-50 text-red-900 border-red-400 dark:bg-red-100',
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

function fmtTgaPctField(value: number | null | undefined, decimals = 2, spaced = false): string {
  const pct = normalizeTgaPct(value);
  return pct == null ? '—' : `${pct.toFixed(decimals)}${spaced ? ' %' : '%'}`;
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
  territorialMedians?: TerritorialAcmMedians;
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
  territorialMedians,
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
  const [effectiveCapRate, setEffectiveCapRate] = useState(
    normalizeTgaRatio(suggestedCapRatePct) ?? 0
  );
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
  const [manualVerifications, setManualVerifications] = useState<{
    pricingSuggestions: Array<{ label: string; value: number | null; rationale: string }>;
    narrativeDraft: string | null;
    status: 'pending_human_review';
    updatedAt: string;
  }>({
    pricingSuggestions: [],
    narrativeDraft: null,
    status: 'pending_human_review',
    updatedAt: new Date().toISOString(),
  });

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
        let adjustedCap = normalizeTgaRatio(capPct) ?? 0;
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

  const multiAngleSuggestions = useMemo(() => {
    if (!result) return [];
    const marketAligned = territorialMedians?.prixParUnite
      ? territorialMedians.prixParUnite * Math.max(1, bootstrap.units)
      : null;
    const performanceBased =
      territorialMedians?.tgaPct && territorialMedians.tgaPct > 0
        ? computeCapitalizedValueFromRneAndTga(
            bootstrap.revenuNetExploitation,
            territorialMedians.tgaPct
          )
        : null;
    const maxPotential = stressSummary?.occ100 ?? null;
    const rows = [
      {
        label: t('Aligné marché', 'Market-aligned'),
        value: marketAligned,
        rationale: t(
          'Basé sur la médiane territoriale prix/unité.',
          'Based on territorial median price per unit.'
        ),
      },
      {
        label: t('Basé performance', 'Performance-based'),
        value: performanceBased,
        rationale: t(
          'Basé sur le revenu net d’exploitation (RNE) et la médiane du taux de capitalisation global (TGA) territorial.',
          'Based on net operating income (NOI) and territorial median capitalization rate (cap rate).'
        ),
      },
      {
        label: t('Potentiel maximum', 'Maximum potential'),
        value: maxPotential,
        rationale: t(
          'Basé sur le scénario de pleine occupation (100%).',
          'Based on full occupancy scenario (100%).'
        ),
      },
    ];
    return rows;
  }, [result, territorialMedians, bootstrap.units, bootstrap.revenuNetExploitation, stressSummary, t]);

  useEffect(() => {
    setManualVerifications({
      pricingSuggestions: multiAngleSuggestions,
      narrativeDraft: narrative?.signedReading ?? null,
      status: 'pending_human_review',
      updatedAt: new Date().toISOString(),
    });
  }, [multiAngleSuggestions, narrative]);

  const ratios = useMemo(() => {
    if (!result) return null;
    return [
      {
        label: t(
          'Taux de capitalisation global (TGA) implicite',
          'Implied global capitalization rate (cap rate)'
        ),
        value:
          result.capRateImpliedAtAsking !== undefined
            ? fmtTgaPctField(result.capRateImpliedAtAsking)
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
      <section className={institutionalListingsCardShellClass}>
        <header className={institutionalListingsCardHeaderClass}>
          <div className={compact ? 'flex flex-wrap items-center justify-between gap-3' : 'flex items-center justify-between gap-3'}>
            <div>
              <p className={institutionalListingsCardTitleClass}>
                {t('Moteur Core · @primexpert/core/valuation', 'Core Engine · @primexpert/core/valuation')}
              </p>
              <h2
                className={
                  compact
                    ? 'mt-1 text-2xl font-black uppercase tracking-tight text-black'
                    : 'mt-1 text-3xl font-black uppercase tracking-tight text-black'
                }
              >
                {t('Analyse comparative de marché (ACM)', 'Comparative market analysis (CMA)')}
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border-2 border-emerald-600 bg-emerald-50 px-3 py-1.5 dark:bg-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-900" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-900">
                {t('Données CRM · SSOT', 'CRM data · SSOT')}
              </span>
            </div>
          </div>
        </header>

        <motion.div className="flex flex-col gap-6 p-5">
          <div className="rounded-xl border-2 border-primexpert-dark/15 bg-primexpert-light dark:bg-primexpert-cardDark p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primexpert-dark" aria-hidden />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                {t('Données sujet verrouillées (financial/dataV2)', 'Locked subject data (financial/dataV2)')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lockedFields.map((f) => (
                <div key={f.label} className="space-y-1">
                  <span className={ACM_METRIC_LABEL_CLASS}>{f.label}</span>
                  <p className={`text-sm truncate ${ACM_METRIC_VALUE_CLASS}`} title={f.value}>
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="acm-target-cap-rate" className={ACM_METRIC_LABEL_CLASS}>
                  {t(
                    'Taux de capitalisation global (TGA) cible (%)',
                    'Target global capitalization rate (cap rate) (%)'
                  )}
                </label>
                {tgaManuallyAdjusted ? (
                  <span className="rounded-lg border-2 border-amber-400 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-950">
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
                <p id="acm-tga-rationale" className="text-[11px] font-semibold leading-relaxed text-slate-800">
                  {capRateRationale}
                  {bootstrap.capRateSampleCount > 0 ? (
                    <span className="text-slate-600"> · n={bootstrap.capRateSampleCount}</span>
                  ) : null}
                </p>
              ) : null}
              {tgaManuallyAdjusted ? (
                <button
                  type="button"
                  onClick={resetTgaToMarket}
                  className={`inline-flex items-center gap-1.5 ${institutionalListingsSecondaryButtonClass}`}
                >
                  <RotateCcw className="h-3 w-3" />
                  {t(
                    'Réinitialiser au taux de capitalisation global (TGA) marché GPS',
                    'Reset to GPS market global cap rate'
                  )}
                </button>
              ) : null}
            </div>
            <label className="space-y-2">
              <span className={ACM_METRIC_LABEL_CLASS}>
                {t(
                  'Pénétration RPA 75+ (%) — ajustement taux de capitalisation global (TGA)',
                  'RPA 75+ penetration (%) — global cap rate adjustment'
                )}
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
              className={`text-left ${institutionalListingsSecondaryButtonClass}`}
            >
              {t(
                'Sélectionner les comparables régionaux (onglet Marché)',
                'Select regional comparables (Market tab)'
              )}
            </button>
          ) : null}
        </motion.div>
      </section>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border-2 border-red-400 bg-red-50 px-5 py-3 text-[11px] font-bold text-red-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {vendorPdfError ? (
        <p className="text-[13px] font-bold text-red-800" role="alert">
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
          <motion.div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className={`md:col-span-2 ${institutionalListingsCardShellClass}`}>
              <header className={institutionalListingsCardHeaderClass}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className={`${institutionalListingsCardTitleClass} flex items-center gap-2`}>
                    <CheckCircle2 className="h-4 w-4 text-primexpert-dark" />
                    {t('Prix suggéré (Core OACIQ)', 'Suggested price (OACIQ Core)')}
                  </h3>
                  <PositioningBadge positioning={result.pricePositioning} t={t} />
                </div>
              </header>
              <div className="p-6">
                <p className={`text-5xl leading-none sm:text-6xl ${ACM_METRIC_VALUE_CLASS}`}>
                  {formatCurrency(result.suggestedPrice)}
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-xl border-2 border-primexpert-dark/15 bg-primexpert-light p-5 dark:bg-primexpert-cardDark">
                    <span className={ACM_METRIC_LABEL_CLASS}>{t('Plancher', 'Floor')}</span>
                    <p className={`mt-1 font-mono text-sm ${ACM_METRIC_VALUE_CLASS}`}>
                      {formatCurrency(result.suggestedLow)}
                    </p>
                  </div>
                  <div className="rounded-xl border-2 border-primexpert-dark/25 bg-white p-5 dark:bg-primexpert-cardDark">
                    <span className={ACM_METRIC_LABEL_CLASS}>{t('Plafond', 'Ceiling')}</span>
                    <p className={`mt-1 font-mono text-sm ${ACM_METRIC_VALUE_CLASS}`}>
                      {formatCurrency(result.suggestedHigh)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className={`${institutionalListingsCardShellClass} flex flex-col gap-4 p-6`}>
              <p className={ACM_METRIC_LABEL_CLASS}>{t('Valeur banquable', 'Bankable value')}</p>
              <p className={`text-3xl ${ACM_METRIC_VALUE_CLASS}`}>
                {formatCurrency(result.bankableValue)}
              </p>
              <p className={`text-[11px] font-bold ${ACM_METRIC_VALUE_CLASS}`}>
                {t('Ratio de couverture du service de la dette (DSCR)', 'Debt service coverage ratio (DSCR)')}{' '}
                · {result.dscrAtAsking.toFixed(2)}
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {ratios?.map((r) => (
              <div key={r.label} className={`${institutionalListingsCardShellClass} p-5`}>
                <p className={ACM_METRIC_LABEL_CLASS}>{r.label}</p>
                <p className={`mt-2 text-xl ${ACM_METRIC_VALUE_CLASS}`}>{r.value}</p>
              </div>
            ))}
          </div>

          {tgaAdjustment ? (
            <div className="rounded-xl border-2 border-primexpert-dark/20 bg-primexpert-light p-5 space-y-2 dark:bg-primexpert-cardDark">
              <p className={ACM_METRIC_LABEL_CLASS}>
                {t(
                  'Ajustement taux de capitalisation global (TGA) — pénétration et taille',
                  'Global cap rate adjustment — penetration and size'
                )}
              </p>
              <p className={`text-sm ${ACM_METRIC_VALUE_CLASS}`}>
                {fmtTgaPctField(tgaAdjustment.baseTga, 2, true)} → {fmtTgaPctField(tgaAdjustment.finalTga, 2, true)}
              </p>
            </div>
          ) : null}

          {stressSummary && recommendedPrice != null ? (
            <div className={`${institutionalListingsCardShellClass} space-y-3 p-5`}>
              <p className={ACM_METRIC_LABEL_CLASS}>
                {t('Scénarios d’occupation et prix recommandé', 'Occupancy scenarios and recommended price')}
              </p>
              <p className="text-xs font-semibold text-slate-800">
                85 % : {formatCurrency(stressSummary.occ85)} · 90 % : {formatCurrency(stressSummary.occ90)} · 100 % :{' '}
                {formatCurrency(stressSummary.occ100)}
              </p>
              <p className={`text-lg ${ACM_METRIC_VALUE_CLASS}`}>
                {t(
                  'Prix recommandé par le moteur financier SSOT',
                  'Recommended price from the financial SSOT engine'
                )}{' '}
                : {formatCurrency(recommendedPrice)}
              </p>
            </div>
          ) : null}

          {territorialMedians ? (
            <div className={`${institutionalListingsCardShellClass} space-y-3 p-5`}>
              <p className={ACM_METRIC_LABEL_CLASS}>
                {t('Médianes territoriales Québec (serveur)', 'Territorial medians Quebec (server)')}
              </p>
              <p className="text-xs font-semibold text-slate-800">
                {territorialMedians.regionAdministrative}
                {territorialMedians.assetClassLabel ? ` · ${territorialMedians.assetClassLabel}` : ''}
                {` · n=${territorialMedians.sampleCount}`}
              </p>
              <p className={`text-xs font-bold ${ACM_METRIC_VALUE_CLASS}`}>
                {t('Taux de capitalisation global (TGA) médian', 'Median global cap rate')}:{' '}
                {territorialMedians.tgaPct?.toFixed(2) ?? '—'}% ·{' '}
                {t('Prix par unité médian', 'Median price per unit')}:{' '}
                {fmtMoneyField(territorialMedians.prixParUnite ?? NaN)} ·{' '}
                {t('Multiple du revenu net (MRN)', 'Net income multiplier (MRN)')}:{' '}
                {territorialMedians.mrn?.toFixed(2) ?? '—'} ·{' '}
                {t('Multiple du revenu brut réel (MRB)', 'Actual gross rent multiplier (GRM)')}:{' '}
                {territorialMedians.mrb?.toFixed(2) ?? '—'}
              </p>
            </div>
          ) : null}

          {manualVerifications.pricingSuggestions.length > 0 ? (
            <div className={`${institutionalListingsCardShellClass} space-y-3 p-5`}>
              <p className={ACM_METRIC_LABEL_CLASS}>
                {t(
                  'Suggestions IA transitoires — validation humaine requise (revenu brut effectif (RBE), revenu net d’exploitation (RNE), taux de capitalisation global (TGA))',
                  'Transient AI suggestions — human validation required (EGI, NOI, global cap rate)'
                )}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {manualVerifications.pricingSuggestions.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-xl border-2 border-primexpert-dark/15 bg-primexpert-light p-3 dark:bg-primexpert-cardDark"
                  >
                    <p className={ACM_METRIC_LABEL_CLASS}>{row.label}</p>
                    <p className={`mt-1 text-lg ${ACM_METRIC_VALUE_CLASS}`}>
                      {row.value != null ? formatCurrency(row.value, { maxDecimals: 0 }) : '—'}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-800">{row.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {result.warnings.length > 0 ? (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-6 space-y-3">
              <motion.div className="flex items-center gap-2">
                <BadgeAlert className="h-4 w-4 text-amber-800" />
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-950">
                  {t('Avertissements moteur', 'Engine warnings')}
                </p>
              </motion.div>
              <ul className="space-y-1.5">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-[12px] font-semibold text-amber-950">
                    — {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <motion.div className={`${institutionalListingsCardShellClass} p-6`}>
            <div className="mb-4 flex items-center gap-3">
              <BookOpen className="h-4 w-4 text-primexpert-dark" />
              <p className={ACM_METRIC_LABEL_CLASS}>{t('Lecture vendeur', 'Seller reading')}</p>
              {narrative ? (
                <span className="ml-auto flex items-center gap-1 text-[9px] font-black uppercase text-slate-800">
                  <Sparkles className="h-3 w-3" />
                  {narrative.source}
                </span>
              ) : null}
            </div>
            {narrativeLoading ? (
              <p className="text-[11px] font-semibold text-slate-700">{t('Génération…', 'Generating…')}</p>
            ) : narrative ? (
              <p className="text-[13px] font-semibold leading-relaxed text-slate-900 whitespace-pre-wrap">
                {narrative.signedReading}
              </p>
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

          <motion.div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className={`md:col-span-2 ${institutionalListingsCardShellClass}`}>
              <header className={institutionalListingsCardHeaderClass}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className={`${institutionalListingsCardTitleClass} flex items-center gap-2`}>
                    <CheckCircle2 className="h-4 w-4 text-primexpert-dark" />
                    {t('Prix suggéré (Core OACIQ)', 'Suggested price (OACIQ Core)')}
                  </h3>
                  <span className="inline-flex items-center gap-2 rounded-lg border-2 border-primexpert-dark/25 bg-primexpert-light px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-800">
                    {t('En attente', 'Pending')}
                  </span>
                </div>
              </header>
              <div className="p-6">
                <p className={`text-5xl leading-none sm:text-6xl ${ACM_METRIC_VALUE_CLASS}`}>—</p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-xl border-2 border-primexpert-dark/15 bg-primexpert-light p-5 dark:bg-primexpert-cardDark">
                    <span className={ACM_METRIC_LABEL_CLASS}>{t('Plancher', 'Floor')}</span>
                    <p className={`mt-1 font-mono text-sm ${ACM_METRIC_VALUE_CLASS}`}>—</p>
                  </div>
                  <div className="rounded-xl border-2 border-primexpert-dark/25 bg-white p-5 dark:bg-primexpert-cardDark">
                    <span className={ACM_METRIC_LABEL_CLASS}>{t('Plafond', 'Ceiling')}</span>
                    <p className={`mt-1 font-mono text-sm ${ACM_METRIC_VALUE_CLASS}`}>—</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={`${institutionalListingsCardShellClass} flex flex-col gap-4 p-6`}>
              <p className={ACM_METRIC_LABEL_CLASS}>{t('Valeur banquable', 'Bankable value')}</p>
              <p className={`text-3xl ${ACM_METRIC_VALUE_CLASS}`}>—</p>
              <p className={`text-[11px] font-bold ${ACM_METRIC_VALUE_CLASS}`}>
                {t('Ratio de couverture du service de la dette (DSCR)', 'Debt service coverage ratio (DSCR)')}{' '}
                · —
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              t(
                'Taux de capitalisation global (TGA) implicite',
                'Implied global capitalization rate (cap rate)'
              ),
              t('Multiple du revenu brut réel (MRB)', 'Actual gross rent multiplier (GRM)'),
              t('Ratio de couverture du service de la dette (DSCR)', 'Debt service coverage ratio (DSCR)'),
              t('Revenu net d’exploitation comptable (RNE)', 'Accounting net operating income (NOI)'),
            ].map((label) => (
              <div key={label} className={`${institutionalListingsCardShellClass} p-5`}>
                <p className={ACM_METRIC_LABEL_CLASS}>{label}</p>
                <p className={`mt-2 text-xl ${ACM_METRIC_VALUE_CLASS}`}>{t('En attente', 'Pending')}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
