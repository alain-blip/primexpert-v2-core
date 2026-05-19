/**
 * Bilan exécutif — Vue CFO / résumé financier de l'inscription (lecture seule).
 * Charte institutionnelle : fond clair, cartes blanches, montants en noir.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Landmark } from 'lucide-react';
import { computeBilanCfoViewModel } from '@primexpert/core/financial';
import { formatCurrency as formatCurrencyCore } from '@primexpert/core/utils/formatting';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { ProvenanceStrip } from '../../financial/ProvenanceStrip';
import { TP70Card } from '../../financial/TP70Card';
import { FinancialReportsSection } from '../../financial/FinancialReportsSection';
import type { Residence } from '../../../services/residences';

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

  const residenceHints = useMemo(
    () =>
      ({
        ...residence,
        prixDemande: residence.price,
        askingPrice: residence.price,
      }) as Record<string, unknown>,
    [residence]
  );

  const cfo = useMemo(
    () => computeBilanCfoViewModel(financialData, residenceHints),
    [financialData, residenceHints]
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
            label={t('EM (emprunt max.)', 'Max debt (EM)')}
            sublabel={t('Capacité d’endettement', 'Debt capacity')}
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
      <FinancialReportsSection />

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
