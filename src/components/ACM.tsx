/**
 * ACM.tsx — Analyse Comparative de Marché (Phase C)
 *
 * Brief « SYSTÈME SILOS 2026 v4 » — Chantier C.2 :
 *   « On retire le Gemini hardcodé de la page ACM pour injecter
 *     ton Valuation Core (extrait en Phase A). »
 *
 * Source de vérité : @primexpert/core/valuation
 *   - calculateValuation(inputs) → ValuationOutputs (TGA, NOI, MRB, MRN, DSCR, etc.)
 *   - createDefaultValuationInputs(overrides)
 *
 * Charte v2026.2 §V — Zone Rouge : ne JAMAIS renommer les slugs canoniques
 *   (askingPrice, units, potentialRevenue, targetCapRate, etc.)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, AlertCircle, CheckCircle2, ShieldCheck, TrendingDown, TrendingUp, BadgeAlert, BookOpen, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { formatCurrency } from '../lib/utils';
import {
  calculateValuation,
  createDefaultValuationInputs,
  DEFAULT_MARKET_BENCHMARKS,
  type ValuationInputs,
  type ValuationOutputs,
} from '@primexpert/core/valuation';
import {
  selectSellerNarrative,
  type SellerNarrativeDecision,
  type ResidenceFinancials,
} from '@primexpert/core/narrative';

interface SimpleForm {
  askingPrice: number;
  units: number;
  potentialRevenue: number;
  otherIncome: number;
  vacancyRate: number;       // entré en % (5 → 0.05)
  operatingExpensesTotal: number;
  targetCapRate: number;     // entré en % (8 → 0.08)
}

const INITIAL_FORM: SimpleForm = {
  askingPrice: 5_000_000,
  units: 45,
  potentialRevenue: 1_200_000,
  otherIncome: 50_000,
  vacancyRate: 5,
  operatingExpensesTotal: 620_000,
  targetCapRate: 8,
};

function buildInputs(form: SimpleForm): ValuationInputs {
  return createDefaultValuationInputs({
    askingPrice: form.askingPrice,
    units: form.units,
    potentialRevenue: form.potentialRevenue,
    otherIncome: form.otherIncome,
    vacancyRate: form.vacancyRate / 100,
    operatingExpenses: { total: form.operatingExpensesTotal },
    customExpenses: [],
    targetCapRate: form.targetCapRate / 100,
  });
}

function PositioningBadge({ positioning, t }: { positioning: ValuationOutputs['pricePositioning']; t: ReturnType<typeof useLanguage>['t'] }) {
  const meta = {
    'sous-évalué': { Icon: TrendingDown, label: t('Sous-évalué', 'Underpriced'), color: 'bg-emerald-500/[0.08] text-emerald-300 border-emerald-400/30' },
    'bien-positionné': { Icon: CheckCircle2, label: t('Bien positionné', 'Well priced'), color: 'bg-blue-500/10 text-blue-300 border-blue-400/30' },
    'surévalué': { Icon: TrendingUp, label: t('Surévalué', 'Overpriced'), color: 'bg-red-500/[0.08] text-red-300 border-red-400/30' },
  }[positioning];
  const Icon = meta.Icon;
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${meta.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </div>
  );
}

export function ACM() {
  const { t } = useLanguage();
  const [form, setForm] = useState<SimpleForm>(INITIAL_FORM);
  const [result, setResult] = useState<ValuationOutputs | null>(null);
  const [narrative, setNarrative] = useState<SellerNarrativeDecision | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof SimpleForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    setForm((prev) => ({ ...prev, [field]: Number.isFinite(next) ? next : 0 }));
  };

  const handleCompute = () => {
    setError(null);
    setNarrative(null);
    try {
      const inputs = buildInputs(form);
      const out = calculateValuation(inputs);
      setResult(out);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // D-1b — Génère la "Lecture Vendeur" dès qu'on a un résultat de valuation.
  // Mode RULES : déterministe, pas d'IA (les Cloud Functions V1 sont étanches
  // au projet V2, cf. RAPPORT_PHASE_C §I.1).
  useEffect(() => {
    if (!result) {
      setNarrative(null);
      return;
    }
    let cancelled = false;
    setNarrativeLoading(true);

    const financials: ResidenceFinancials = {
      rbe: result.effectiveGrossIncome,
      noi: result.noiAccounting,
      totalExpenses: result.operatingExpensesTotal,
      prixDemande: form.askingPrice,
    };

    selectSellerNarrative(
      financials,
      DEFAULT_MARKET_BENCHMARKS,
      { capRateMedian: result.capRateMarketSelected },
      { narrativeMode: 'RULES' }
    )
      .then((decision) => {
        if (!cancelled) setNarrative(decision);
      })
      .catch((e) => {
        console.error('[ACM] narrative error', e);
        if (!cancelled) setNarrative(null);
      })
      .finally(() => {
        if (!cancelled) setNarrativeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [result, form.askingPrice]);

  const ratios = useMemo(() => {
    if (!result) return null;
    return [
      { label: t('TGA implicite', 'Implied cap rate'), value: result.capRateImpliedAtAsking !== undefined ? `${(result.capRateImpliedAtAsking * 100).toFixed(2)}%` : '—' },
      { label: t('MRB réel', 'Actual MRB'), value: result.actualMrbAtAsking.toFixed(2) },
      { label: t('DSCR (prix demandé)', 'DSCR (asking)'), value: result.dscrAtAsking.toFixed(2) },
      { label: t('NOI comptable', 'Accounting NOI'), value: formatCurrency(result.noiAccounting) },
    ];
  }, [result, t]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-vault text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                {t('Moteur Core · @primexpert/core/valuation', 'Core Engine · @primexpert/core/valuation')}
              </p>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase">
                {t('ACM', 'CMA')}
                <span className="text-blue-500">{t('_OACIQ', '_OACIQ')}</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-100">
                {t('Calcul local · zéro Gemini', 'Local compute · zero Gemini')}
              </span>
            </div>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { key: 'askingPrice', label: t('Prix demandé ($)', 'Asking price ($)'), step: 50000 },
              { key: 'units', label: t('Nombre d\'unités', 'Units'), step: 1 },
              { key: 'potentialRevenue', label: t('Revenus annuels potentiels ($)', 'Potential annual revenue ($)'), step: 10000 },
              { key: 'otherIncome', label: t('Autres revenus ($)', 'Other income ($)'), step: 1000 },
              { key: 'vacancyRate', label: t('Taux de vacance (%)', 'Vacancy rate (%)'), step: 0.5 },
              { key: 'operatingExpensesTotal', label: t('Dépenses d\'exploitation ($)', 'Operating expenses ($)'), step: 10000 },
              { key: 'targetCapRate', label: t('TGA cible (%)', 'Target cap rate (%)'), step: 0.1 },
            ].map(({ key, label, step }) => (
              <label key={key} className="space-y-2">
                <span className="block text-[10px] font-black uppercase tracking-widest text-blue-300/60">{label}</span>
                <input
                  type="number"
                  step={step}
                  value={form[key as keyof SimpleForm]}
                  onChange={handleChange(key as keyof SimpleForm)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white/10 focus:border-blue-400 outline-none transition"
                />
              </label>
            ))}
          </div>

          <button
            onClick={handleCompute}
            className="w-full py-4 bg-vault text-blue-300 font-black rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl uppercase text-[11px] tracking-widest"
          >
            <Calculator className="w-5 h-5" />
            {t('Calculer la valorisation', 'Run valuation')}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/[0.08] px-5 py-3 text-[11px] font-semibold text-red-300">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          {/* Prix suggéré + fourchette + positioning */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-vault-bright p-10 rounded-[32px] border border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  {t('Prix suggéré (Core OACIQ)', 'Suggested price (OACIQ Core)')}
                </h3>
                <PositioningBadge positioning={result.pricePositioning} t={t} />
              </div>

              <div className="flex items-end gap-3 mb-8">
                <span className="text-6xl font-black italic tracking-tighter text-slate-300 leading-none">
                  {result.suggestedPrice.toLocaleString('fr-CA')}{' '}
                  <span className="text-3xl text-blue-400">$</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-white/[0.03] rounded-xl border border-white/10">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('Plancher', 'Floor')}</span>
                  <p className="font-mono text-sm font-black text-slate-300 mt-1">{formatCurrency(result.suggestedLow)}</p>
                </div>
                <div className="p-5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">{t('Plafond', 'Ceiling')}</span>
                  <p className="font-mono text-sm font-black text-blue-300 mt-1">{formatCurrency(result.suggestedHigh)}</p>
                </div>
              </div>
            </div>

            {/* Banque */}
            <div className="bg-blue-500 text-white p-8 rounded-[32px] shadow-lg flex flex-col gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full blur-[40px] -mr-10 -mt-10" />
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">{t('Valeur banquable', 'Bankable value')}</p>
              <p className="text-3xl font-black italic tracking-tight leading-none">{formatCurrency(result.bankableValue)}</p>
              <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-blue-100/80 space-y-1">
                <p>DSCR · {result.dscrAtAsking.toFixed(2)}</p>
                <p>LTV max · {(result.loanAmount / result.suggestedPrice * 100 || 0).toFixed(0)}%</p>
                <p>Prêt · {formatCurrency(result.loanAmount)}</p>
              </div>
            </div>
          </div>

          {/* Ratios */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ratios?.map((r) => (
              <div key={r.label} className="rounded-2xl border border-white/10 bg-vault-bright p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{r.label}</p>
                <p className="mt-2 text-xl font-black italic tracking-tighter text-slate-300">{r.value}</p>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/[0.08] p-6 space-y-3">
              <div className="flex items-center gap-2">
                <BadgeAlert className="h-4 w-4 text-amber-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                  {t('Avertissements moteur', 'Engine warnings')}
                </p>
              </div>
              <ul className="space-y-1.5">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-[12px] font-semibold leading-relaxed text-amber-300">— {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Lecture Vendeur — NarrativeEngine du Core (Phase D-1b) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-white/10 bg-vault p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {t('Lecture Vendeur', 'Seller Reading')}
                  </p>
                  <p className="text-sm font-black italic tracking-tight text-white">
                    {t('NarrativeEngine · @primexpert/core/narrative', 'NarrativeEngine · @primexpert/core/narrative')}
                  </p>
                </div>
              </div>
              {narrative && (
                <div className="flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1">
                  <Sparkles className="h-3 w-3 text-indigo-600" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700 font-mono">
                    {narrative.source} · {narrative.confidence}
                  </span>
                </div>
              )}
            </div>

            {narrativeLoading && (
              <p className="text-[11px] font-semibold text-slate-500">
                {t('Génération de la lecture…', 'Generating reading…')}
              </p>
            )}

            {narrative && !narrativeLoading && (
              <div className="space-y-5">
                <p className="text-[11px] font-bold italic text-indigo-700">{narrative.readingAngle}</p>
                <p className="text-[13px] leading-relaxed font-medium text-slate-300 whitespace-pre-wrap">
                  {narrative.signedReading}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-white/10">
                  {narrative.talkTrackBullets.map((b, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.03] px-4 py-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                        {t('Argument', 'Pitch')} {i + 1}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-300 leading-snug">{b}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* HITL — Garde-fou OACIQ */}
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
              {t('Charte OACIQ §IV — Validation humaine requise', 'OACIQ Charter §IV — Human validation required')}
            </p>
            <p className="mt-2 text-[12px] font-semibold text-slate-300">
              {t(
                "Cette ACM est une opinion motivée par le moteur. Elle doit être révisée et signée par le courtier avant diffusion au client.",
                'This CMA is a motivated opinion from the engine. It must be reviewed and signed by the broker before client release.'
              )}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
