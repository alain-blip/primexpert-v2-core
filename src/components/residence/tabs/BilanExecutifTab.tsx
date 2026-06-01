/**
 * Bilan exécutif — Vue CFO / résumé financier de l'inscription (lecture seule).
 * Charte institutionnelle : fond clair, cartes blanches, montants en noir.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Landmark, ShieldAlert, Users2 } from 'lucide-react';
import { computeBilanCfoViewModel } from '@primexpert/core/financial';
import { formatCurrency as formatCurrencyCore } from '@primexpert/core/utils/formatting';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { ProvenanceStrip } from '../../financial/ProvenanceStrip';
import { TP70Card } from '../../financial/TP70Card';
import { FinancialReportsSection } from '../../financial/FinancialReportsSection';
import type { Residence } from '../../../services/residences';
import { useResidenceFinancialHints } from '../../../context/ResidenceDataContext';

/** Médiane sectorielle RPA — ratio employés / unités (référence interne). */
const RPA_RH_RATIO_MEDIAN_LOW = 0.8;
const RPA_RH_RATIO_MEDIAN_HIGH = 1.2;

function readSafeNumber(source: Record<string, unknown>, keys: ReadonlyArray<string>): number {
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === '') continue;
    const value = typeof raw === 'string' ? parseFloat(raw.replace(/[^\d.-]/g, '')) : Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function sumSafeNumbers(source: Record<string, unknown>, keys: ReadonlyArray<string>): number {
  let total = 0;
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === '') continue;
    const value = typeof raw === 'string' ? parseFloat(raw.replace(/[^\d.-]/g, '')) : Number(raw);
    if (Number.isFinite(value)) total += value;
  }
  return total;
}

function occupancyTone(rate: number): {
  bar: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  labelFr: string;
  labelEn: string;
} {
  if (rate >= 90) {
    return {
      bar: 'bg-emerald-600',
      text: 'text-emerald-900',
      badgeBg: 'bg-emerald-600',
      badgeText: 'text-white',
      labelFr: 'OPTIMAL',
      labelEn: 'OPTIMAL',
    };
  }
  if (rate >= 75) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-900',
      badgeBg: 'bg-amber-500',
      badgeText: 'text-amber-950',
      labelFr: 'SURVEILLANCE',
      labelEn: 'WATCH',
    };
  }
  return {
    bar: 'bg-red-600',
    text: 'text-red-900',
    badgeBg: 'bg-red-700',
    badgeText: 'text-white',
    labelFr: 'ALERTE',
    labelEn: 'ALERT',
  };
}

interface OperationalRpaSnapshot {
  totalUnits: number;
  occupancyRate: number;
  hasOccupancy: boolean;
  totalEmployees: number;
  rhRatio: number | null;
  rhAlert: boolean;
}

function resolveOperationalSnapshot(residence: Record<string, unknown>): OperationalRpaSnapshot {
  const totalUnits = readSafeNumber(residence, [
    'nombreUnitesTotal',
    'totalUnits',
    'nombreUnites',
    'unitsCount',
    'unites',
  ]);
  const occupancyRaw = readSafeNumber(residence, [
    'occupancyRate',
    'tauxOccupation',
    'tauxOccupationPct',
    'tauxOccupationGlobal',
  ]);
  const occupancyRate = occupancyRaw > 0 && occupancyRaw <= 1 ? occupancyRaw * 100 : occupancyRaw;
  const totalEmployeesField = readSafeNumber(residence, [
    'nombreEmployesTotal',
    'nombreEmployes',
    'employesTotal',
    'staffCount',
  ]);
  const totalEmployeesSplit = sumSafeNumbers(residence, [
    'nombreEmployesSoins',
    'nombreEmployesCuisine',
    'nombreEmployesEntretien',
    'nombreEmployesAdmin',
  ]);
  const totalEmployees = Math.max(totalEmployeesField, totalEmployeesSplit);
  const rhRatio = totalUnits > 0 && totalEmployees > 0 ? totalEmployees / totalUnits : null;
  const rhAlert =
    rhRatio != null &&
    (rhRatio < RPA_RH_RATIO_MEDIAN_LOW || rhRatio > RPA_RH_RATIO_MEDIAN_HIGH);
  return {
    totalUnits,
    occupancyRate,
    hasOccupancy: occupancyRate > 0,
    totalEmployees,
    rhRatio,
    rhAlert,
  };
}

function OperationalRpaSection({
  snapshot,
  language,
}: {
  snapshot: OperationalRpaSnapshot;
  language: 'fr' | 'en';
}) {
  const occTone = occupancyTone(snapshot.occupancyRate);
  const occLabel = snapshot.hasOccupancy ? `${snapshot.occupancyRate.toFixed(1)} %` : '—';

  return (
    <section className="rounded-2xl border-2 border-[#142c6a]/30 bg-white p-5 shadow-sm">
      <header className="mb-4">
        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#142c6a]">
          {language === 'fr'
            ? 'Indicateurs opérationnels — résidence pour aînés (RPA)'
            : 'Operational indicators — seniors residence (RPA)'}
        </p>
        <p className="mt-1 text-[15px] font-semibold leading-relaxed text-slate-800">
          {language === 'fr'
            ? 'Deux jauges critiques pour la lecture courtier : remplissage et structure de personnel.'
            : 'Two critical broker gauges: occupancy fill rate and staffing structure.'}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border-2 border-[#142c6a]/25 bg-[#f1f5f9] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-black uppercase tracking-wider text-[#142c6a]">
              {language === 'fr' ? 'Taux d’occupation global' : 'Overall occupancy rate'}
            </p>
            {snapshot.hasOccupancy && (
              <span
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-widest',
                  occTone.badgeBg,
                  occTone.badgeText
                )}
              >
                {language === 'fr' ? occTone.labelFr : occTone.labelEn}
              </span>
            )}
          </div>
          <p
            className={cn(
              'mt-2 text-[28px] font-black tabular-nums leading-none',
              occTone.text
            )}
          >
            {occLabel}
          </p>
          <div className="relative mt-4 h-4 overflow-hidden rounded-full border border-slate-300 bg-slate-200">
            <div
              className={cn('absolute inset-y-0 left-0 transition-all duration-300', occTone.bar)}
              style={{
                width: snapshot.hasOccupancy
                  ? `${Math.min(100, Math.max(0, snapshot.occupancyRate))}%`
                  : '0%',
              }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-700"
              style={{ left: '75%' }}
              title="75 %"
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-emerald-800"
              style={{ left: '90%' }}
              title="90 %"
            />
          </div>
          <div className="mt-2 flex justify-between text-[12px] font-bold text-slate-700">
            <span>0 %</span>
            <span className="text-amber-800">75 %</span>
            <span className="text-emerald-800">90 %</span>
            <span>100 %</span>
          </div>
          <p className="mt-3 text-[15px] font-semibold leading-relaxed text-black">
            {language === 'fr'
              ? snapshot.hasOccupancy
                ? snapshot.occupancyRate >= 90
                  ? 'Remplissage optimal — argument fort à mettre de l’avant en présentation acheteur.'
                  : snapshot.occupancyRate >= 75
                    ? 'Marge de progression : vérifier les unités vacantes et l’absorption marché.'
                    : 'Sous-performance — risque de revenus instables, à documenter avant présentation prêteur.'
                : 'Saisir le taux d’occupation pour activer la jauge bancaire.'
              : snapshot.hasOccupancy
                ? snapshot.occupancyRate >= 90
                  ? 'Optimal fill rate — strong selling point in buyer pitch.'
                  : snapshot.occupancyRate >= 75
                    ? 'Headroom to grow: review vacant units and market absorption.'
                    : 'Under-performance — unstable revenue risk, document before lender submission.'
                : 'Enter occupancy rate to activate the bank gauge.'}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#142c6a]/25 bg-[#f1f5f9] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-black uppercase tracking-wider text-[#142c6a]">
              {language === 'fr' ? 'Ratio de structure RH' : 'Staffing structure ratio'}
            </p>
            {snapshot.rhAlert && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-amber-950">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                {language === 'fr' ? 'À ANALYSER' : 'REVIEW'}
              </span>
            )}
          </div>
          <p className="mt-2 flex items-end gap-2 text-[28px] font-black tabular-nums leading-none text-[#142c6a]">
            <Users2 className="h-7 w-7 text-[#142c6a]" aria-hidden />
            {snapshot.rhRatio != null ? snapshot.rhRatio.toFixed(2) : '—'}
            <span className="text-[15px] font-bold text-slate-700">
              {language === 'fr' ? 'empl. / unité' : 'staff / unit'}
            </span>
          </p>
          <p className="mt-3 text-[15px] font-bold text-slate-800">
            {language === 'fr'
              ? `${snapshot.totalEmployees} employés · ${snapshot.totalUnits} unités`
              : `${snapshot.totalEmployees} staff · ${snapshot.totalUnits} units`}
            <span className="ml-2 text-[13px] font-semibold text-slate-600">
              {language === 'fr'
                ? `(médiane RPA : ${RPA_RH_RATIO_MEDIAN_LOW.toFixed(1)} – ${RPA_RH_RATIO_MEDIAN_HIGH.toFixed(1)})`
                : `(RPA median: ${RPA_RH_RATIO_MEDIAN_LOW.toFixed(1)} – ${RPA_RH_RATIO_MEDIAN_HIGH.toFixed(1)})`}
            </span>
          </p>
          {snapshot.rhRatio == null ? (
            <p className="mt-3 text-[15px] font-semibold leading-relaxed text-black">
              {language === 'fr'
                ? 'Renseigner le nombre d’employés et d’unités pour évaluer la structure de personnel.'
                : 'Provide staff and unit counts to evaluate the staffing structure.'}
            </p>
          ) : snapshot.rhAlert ? (
            <p className="mt-3 rounded-xl border-2 border-amber-500 bg-amber-50 px-3 py-2 text-[15px] font-semibold leading-relaxed text-amber-950">
              {language === 'fr'
                ? snapshot.rhRatio > RPA_RH_RATIO_MEDIAN_HIGH
                  ? '⚠ Structure de personnel élevée — analyse des quarts requise pour valider la masse salariale et le levier de normalisation.'
                  : '⚠ Structure de personnel sous la médiane sectorielle — confirmer le niveau de service avant présentation prêteur.'
                : snapshot.rhRatio > RPA_RH_RATIO_MEDIAN_HIGH
                  ? '⚠ High staffing ratio — shift analysis required to validate payroll and the normalization lever.'
                  : '⚠ Staffing below sector median — confirm service level before lender submission.'}
            </p>
          ) : (
            <p className="mt-3 text-[15px] font-semibold leading-relaxed text-black">
              {language === 'fr'
                ? 'Structure de personnel dans la médiane sectorielle — aucune réserve particulière sur la masse salariale.'
                : 'Staffing within sector median — no particular payroll reservation.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function CfoKpiCard({
  label,
  sublabel,
  value,
  className,
}: {
  label: string;
  sublabel?: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm',
        className
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 leading-snug">
        {label}
      </p>
      {sublabel ? (
        <p className="text-[9px] text-slate-500 mt-0.5 normal-case font-medium">{sublabel}</p>
      ) : null}
      <p className="mt-2 text-2xl font-black tracking-tight text-[#142c6a] tabular-nums">
        {value}
      </p>
    </div>
  );
}

export interface BilanExecutifTabProps {
  residence: Residence;
}

export function BilanExecutifTab({ residence }: BilanExecutifTabProps) {
  const { t, language } = useLanguage();
  const { financialData, loading, error, isInProvider } = useFinancialData();

  const residenceHints = useResidenceFinancialHints(residence) as Record<string, unknown>;

  const cfo = useMemo(
    () => computeBilanCfoViewModel(financialData, residenceHints),
    [financialData, residenceHints]
  );

  const operationalSnapshot = useMemo(
    () => resolveOperationalSnapshot(residenceHints),
    [residenceHints]
  );

  const fmt = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? formatCurrencyCore(n, { fallback: '—' }) : '—';

  const fmtDscr = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? `${n.toFixed(2)}×` : '—';

  if (!isInProvider) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        {t(
          'Hub Finance mal configuré : FinancialDataProvider manquant.',
          'Finance Hub misconfigured: missing FinancialDataProvider.'
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-16 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
          {t('Chargement du bilan CFO…', 'Loading CFO summary…')}
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

  const perf = cfo.performance;
  const bank = cfo.bankability;
  const noiDisplay = perf.noiRetenu ?? perf.noiDeclared;

  return (
    <div className="space-y-6 font-sans text-slate-800">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
        <Landmark className="h-5 w-5 text-slate-700 shrink-0" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#142c6a]">
            {t('Vue CFO · Résumé financier de l’inscription', 'CFO view · Listing financial summary')}
          </p>
          <p className="text-[10px] text-slate-600 font-mono mt-0.5">
            {t('Source', 'Source')}: {cfo.source} · {t('Lecture seule', 'Read-only')}
          </p>
        </div>
      </div>

      {cfo.incompleteSimulation && (
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-[#142c6a] leading-relaxed">
            {t(
              'Données financières de l’inscription incomplètes pour la simulation.',
              'Listing financial data incomplete for simulation.'
            )}
          </p>
        </div>
      )}

      <ProvenanceStrip
        lastUpdated={
          (financialData as { lastUpdated?: unknown; updatedAt?: unknown } | null)?.lastUpdated ??
          (financialData as { updatedAt?: unknown } | null)?.updatedAt
        }
        source={cfo.source}
        confidenceTier={cfo.incompleteSimulation ? 'validation_required' : 'medium'}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#142c6a] mb-4">
          {t('Performance de l’inscription', 'Listing performance')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <CfoKpiCard label={t('Prix demandé', 'Asking price')} value={fmt(perf.prixDemande)} />
          <CfoKpiCard
            label={t('Revenus bruts (RBE)', 'Gross revenue (EGR)')}
            value={fmt(perf.rbe)}
          />
          <CfoKpiCard
            label={t('Dépenses d’exploitation', 'Operating expenses')}
            sublabel={
              perf.usesNormalizedExpenses
                ? t('Total normalisé (grille CPA)', 'Normalized total (CPA grid)')
                : t('Total déclaré', 'Declared total')
            }
            value={fmt(perf.operatingExpenses)}
          />
          <CfoKpiCard
            label={t('RNE déclaré — BAIIA', 'Reported NOI — EBITDA')}
            sublabel={
              perf.noiAudit != null &&
              perf.noiDeclared != null &&
              perf.noiAudit !== perf.noiDeclared
                ? t(`Vérifié : ${fmt(perf.noiAudit)}`, `Verified: ${fmt(perf.noiAudit)}`)
                : undefined
            }
            value={fmt(noiDisplay)}
          />
        </div>
      </section>

      <OperationalRpaSection
        snapshot={operationalSnapshot}
        language={language === 'fr' ? 'fr' : 'en'}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#142c6a] mb-1">
          {t('Bancabilité commerciale', 'Commercial bankability')}
        </h3>
        <p className="text-[10px] text-slate-600 mb-4">
          {language === 'fr' ? bank.programLabelFr : bank.programLabelEn}
          {bank.amortYears != null
            ? ` · ${t('Amortissement', 'Amortization')} ${bank.amortYears} ${t('ans', 'yr')}`
            : ''}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CfoKpiCard
            label={t('RCD (DSCR)', 'DSCR')}
            sublabel={t('Ratio cible simulation', 'Simulation target ratio')}
            value={fmtDscr(bank.dscrTarget)}
          />
          <CfoKpiCard
            label={t(
              'Emprunt maximum autorisé (le plus bas des critères)',
              'Maximum authorized loan (lowest of criteria)'
            )}
            sublabel={t(
              'Ratio de couverture (DSCR) et ratio prêt-valeur (RPV)',
              'Debt service coverage ratio (DSCR) and loan-to-value (LTV)'
            )}
            value={bank.canSimulate ? fmt(bank.empruntMax) : '—'}
          />
          <CfoKpiCard
            label={t('MFR (mise de fonds)', 'Equity (MFR)')}
            sublabel={t('Prix demandé − emprunt retenu', 'Asking price − retained loan')}
            value={bank.canSimulate ? fmt(bank.miseDeFonds) : '—'}
          />
        </div>
        {bank.canSimulate && bank.ratioCouverture != null && (
          <p className="mt-3 text-[10px] font-mono text-slate-600">
            {t('DSCR résultant', 'Resulting DSCR')}:{' '}
            <span className="font-bold text-[#142c6a]">{fmtDscr(bank.ratioCouverture)}</span>
          </p>
        )}
      </section>

      <TP70Card residenceHints={residenceHints} />
      <FinancialReportsSection residence={residence} />

      {!cfo.hasFinancials && (
        <p className="text-xs text-slate-600 italic text-center">
          {t(
            'Aucune donnée financial/dataV2 — chiffres dérivés de la fiche inscription uniquement.',
            'No financial/dataV2 — figures derived from listing record only.'
          )}
        </p>
      )}
    </div>
  );
}
