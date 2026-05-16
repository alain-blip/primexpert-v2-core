/**
 * Audit de Performance 360° — Manque à gagner / impact valeur (Phase 3d).
 * SSOT : computePerformanceAudit360() + useFinancialData().
 */

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Info,
  Microscope,
  TrendingUp,
} from 'lucide-react';
import {
  computePerformanceAudit360,
  normalizeFinancialData,
  OPTIMIZATION_360_RULES,
} from '@primexpert/core/financial';
import { formatCurrency as formatCurrencyCore } from '@primexpert/core/utils/formatting';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { ProvenanceStrip } from '../../financial/ProvenanceStrip';
import {
  inst,
  InstitutionalKpi,
  InstitutionalPageHeader,
} from '../institutional/InstitutionalUi';
import type { Residence } from '../../../services/residences';

export interface Analyse360FinanceTabProps {
  residence: Residence;
}

export function Analyse360FinanceTab({ residence }: Analyse360FinanceTabProps) {
  const { t, language } = useLanguage();
  const { financialData, loading, error, isInProvider } = useFinancialData();

  const residenceHints = useMemo(
    () =>
      ({
        ...residence,
        prixDemande: residence.price,
        askingPrice: residence.price,
      }) as Record<string, unknown>,
    [residence]
  );

  const fmt = (n: number | null) =>
    n != null && Number.isFinite(n) ? formatCurrencyCore(n, { fallback: '—' }) : '—';

  const { calc, baseData, hasFinancials } = useMemo(
    () => normalizeFinancialData(financialData, residenceHints),
    [financialData, residenceHints]
  );

  const audit = useMemo(
    () =>
      computePerformanceAudit360({
        residence: residenceHints,
        calc,
        baseData,
        prixDemande: residence.price,
      }),
    [residenceHints, calc, baseData, residence.price]
  );

  if (!isInProvider) {
    return <div className={inst.alertAmber}>{t('Provider financier manquant.', 'Financial provider missing.')}</div>;
  }

  if (loading) {
    return (
      <div className={inst.loading}>
        <p className={inst.loadingText}>{t('Chargement de l’audit 360°…', 'Loading 360° audit…')}</p>
      </div>
    );
  }

  if (error) {
    return <div className={inst.alertRed}>{error.message}</div>;
  }

  if (!hasFinancials || !audit.hasData) {
    return (
      <div className={cn(inst.section, 'p-6')}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
          <div>
            <p className={inst.pageTitle}>{t('Audit de performance 360°', '360° performance audit')}</p>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              {language === 'fr'
                ? audit.insufficientReasonFr ??
                  'Données financières insuffisantes — complétez la grille Revenus & Dépenses (dataV2).'
                : audit.insufficientReasonEn ??
                  'Insufficient financial data — complete the Revenue & Expenses grid (dataV2).'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const capNote =
    audit.capRateSource === 'fiche'
      ? t(`Taux de capitalisation retenu : ${audit.capRatePct.toFixed(2)} % (fiche)`, `Cap rate: ${audit.capRatePct.toFixed(2)}% (listing)`)
      : t(
          `Taux de capitalisation par défaut : ${audit.capRatePct.toFixed(0)} % (repli TGA)`,
          `Default cap rate: ${audit.capRatePct.toFixed(0)}% (TGA fallback)`
        );

  return (
    <div className={cn('space-y-5', inst.page)}>
      <InstitutionalPageHeader
        icon={<Microscope className="h-5 w-5 text-slate-700 shrink-0" />}
        title={t('Audit 360° · Manque à gagner & levier de valeur', '360° audit · Lost profits & value lever')}
      />

      <ProvenanceStrip
        lastUpdated={(financialData as { lastUpdated?: unknown })?.lastUpdated}
        source="financial/dataV2"
        confidenceTier={audit.confidenceTier}
      />

      <p className={inst.note}>
        {t(
          'Comparaison du RBE et des dépenses normalisées (grille CPA) aux références marché. L’écart de NOI annuel est capitalisé au taux de la fiche : ΔV = ΔNOI ÷ (Cap Rate).',
          'Compare normalized EGI and expenses to market references. Annual NOI gap is capitalized at listing cap rate: ΔV = ΔNOI ÷ Cap Rate.'
        )}{' '}
        <span className="text-slate-600">
          {t(
            `Réf. dépenses : ${audit.benchmarkSource === 'sector_ref' ? 'secteur RPA' : 'portefeuille'}.`,
            `Expense ref: ${audit.benchmarkSource === 'sector_ref' ? 'RPA sector' : 'portfolio'}.`
          )}
        </span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <InstitutionalKpi
          label={t('Manque à gagner annuel (NOI)', 'Annual lost NOI')}
          sublabel={t('Leviers revenus + dépenses vs marché', 'Revenue + expense levers vs market')}
          value={fmt(audit.totalNoiGapAnnual)}
        />
        <InstitutionalKpi
          label={t('Impact valeur (capitalisation)', 'Value impact (cap.)')}
          sublabel={capNote}
          value={fmt(audit.totalValueImpact)}
        />
        <InstitutionalKpi
          label={t('Valeur récupérable', 'Recoverable value')}
          sublabel={t('Levier revenus / loyers', 'Revenue / rent lever')}
          value={fmt(audit.valeurRecuperable)}
        />
        <InstitutionalKpi
          label={t('Prix cible optimisé', 'Target optimized price')}
          sublabel={t(`Base ${fmt(audit.basePrice)} ± impacts`, `Base ${fmt(audit.basePrice)} ± impacts`)}
          value={fmt(audit.targetOptimizedPrice)}
        />
      </div>

      <div className={cn(inst.kpi, 'p-5')}>
        <p className={inst.kpiLabel}>{t('Répartition impact valeur', 'Value impact split')}</p>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-200 mt-3">
          <div
            className="bg-red-500"
            style={{ width: `${audit.gaugeLostPct}%` }}
            title={t('Valeur perdue (dépenses)', 'Value lost (expenses)')}
          />
          <div
            className="bg-emerald-600"
            style={{ width: `${audit.gaugeRecoverPct}%` }}
            title={t('Valeur récupérable (revenus)', 'Recoverable (revenue)')}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-mono">
          <span className="text-slate-700">
            {t('Perdu', 'Lost')} <span className="font-black text-[#000000]">{fmt(audit.valeurPerdue)}</span>
          </span>
          <span className="text-slate-700">
            {t('Récupérable', 'Recover')}{' '}
            <span className="font-black text-[#000000]">{fmt(audit.valeurRecuperable)}</span>
          </span>
        </div>
      </div>

      <section className={inst.section}>
        <header className={cn(inst.sectionHeader, 'flex items-center gap-2')}>
          <TrendingUp className="h-4 w-4 text-slate-700" />
          <h3 className={inst.sectionTitle}>{t('1 · Opportunités identifiées', '1 · Identified opportunities')}</h3>
        </header>
        <div className={inst.tableWrap}>
          <table className={inst.table}>
            <thead>
              <tr>
                <th className={inst.th}>{t('Levier', 'Lever')}</th>
                <th className={inst.th}>{t('Constat', 'Finding')}</th>
                <th className={inst.thRight}>{t('Δ NOI / an', 'Δ NOI / yr')}</th>
                <th className={inst.thRight}>{t('Impact valeur', 'Value impact')}</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.map((row) => (
                <tr key={row.id} className={inst.tr}>
                  <td className="px-5 py-3 font-semibold text-[#000000] whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {row.direction === 'recover' ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 text-red-700" />
                      )}
                      {language === 'fr' ? row.leverFr : row.leverEn}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs max-w-md">
                    {language === 'fr' ? row.constatFr : row.constatEn}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-black text-[#000000] tabular-nums">
                    {fmt(row.noiGapAnnual)}
                  </td>
                  <td className={inst.tdValueMono}>{fmt(row.valueImpact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={inst.section}>
        <header className={inst.sectionHeader}>
          <h3 className={inst.sectionTitle}>
            {t('2 · Écarts par poste (grille CPA normalisée)', '2 · Line-item variances (normalized CPA grid)')}
          </h3>
        </header>
        {audit.expenseVarianceTop.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">
            {t(
              'Aucun écart significatif vs la référence marché sur les postes suivis.',
              'No significant variance vs market reference on tracked lines.'
            )}
          </p>
        ) : (
          <div className={inst.tableWrap}>
            <table className={cn(inst.table, 'min-w-[520px]')}>
              <thead>
                <tr>
                  <th className={inst.th}>{t('Poste', 'Line')}</th>
                  <th className={inst.thRight}>{t('Réel norm.', 'Norm. actual')}</th>
                  <th className={inst.thRight}>{t('Réf. marché', 'Market ref.')}</th>
                  <th className={inst.thRight}>{t('Écart $', 'Variance $')}</th>
                </tr>
              </thead>
              <tbody>
                {audit.expenseVarianceTop.map((row) => (
                  <tr key={row.key} className={inst.tr}>
                    <td className="px-5 py-2.5 font-semibold text-[#000000]">{row.label}</td>
                    <td className={inst.tdValueMono}>{fmt(row.actualNorm)}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                      {fmt(row.benchmarkDollar)}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-2.5 text-right font-mono font-black tabular-nums',
                        row.ecartDollar > 0 ? 'text-red-800' : row.ecartDollar < 0 ? 'text-emerald-800' : 'text-[#000000]'
                      )}
                    >
                      {row.ecartDollar > 0 ? '+' : ''}
                      {fmt(row.ecartDollar)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {audit.sectorFallbackActive && (
        <div className={inst.alertAmber}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
            <p>
              {t(
                `Analyse partielle : repli RDE sectoriel ${(OPTIMIZATION_360_RULES.EXPENSE_RATIO_TARGET * 100).toFixed(0)} % du RBE faute de benchmark ligne à ligne.`,
                `Partial analysis: ${(OPTIMIZATION_360_RULES.EXPENSE_RATIO_TARGET * 100).toFixed(0)}% EGI sector RDE fallback — line benchmarks unavailable.`
              )}
            </p>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-600 italic px-1 leading-relaxed">
        {t(
          'Document de travail — non opposable. Validation CPA / courtier requise avant engagement transactionnel.',
          'Working document — not binding. CPA / broker validation required before transaction.'
        )}
      </p>
    </div>
  );
}
