/**
 * Vérification EEE — prudence bancaire (réserve remplacement / CFE).
 */

import React, { useMemo } from 'react';
import { Landmark, Info } from 'lucide-react';
import {
  computeFinancialAuditEee,
  normalizeCapitalizationRatePct,
} from '@primexpert/core/financial';
import { useFinancialData } from '../../context/FinancialDataContext';
import { useLanguage } from '../../lib/i18n';
import { formatCurrency } from '../../lib/utils';
import type { Residence } from '../../services/residences';

export interface FinancialAuditEeePanelProps {
  residence: Residence;
  prixDemande?: number;
  paiementAnnuelDette?: number;
}

export function FinancialAuditEeePanel({
  residence,
  prixDemande,
  paiementAnnuelDette = 0,
}: FinancialAuditEeePanelProps) {
  const { t, language } = useLanguage();
  const { financialData } = useFinancialData();
  const calc = financialData?.calculatedResults;
  const baseData = financialData?.baseData ?? null;

  const audit = useMemo(
    () =>
      computeFinancialAuditEee({
        residence: {
          ...residence,
          nombreUnitesTotal: residence.nicheMetadata?.nombreUnites,
          nombreUnites: residence.nicheMetadata?.nombreUnites,
          prixDemande: prixDemande ?? residence.price,
        },
        calc,
        baseData,
        prixDemande: prixDemande ?? residence.price ?? 0,
        paiementAnnuelDette,
      }),
    [residence, calc, baseData, prixDemande, paiementAnnuelDette]
  );

  if (!calc || (audit.noiReported <= 0 && audit.alerts.length === 0)) return null;

  const L = language === 'fr';
  const fmt = (n: number) => formatCurrency(n, { maxDecimals: 0 });
  const fmtPct = (x: number | null) =>
    x != null && Number.isFinite(x)
      ? `${(normalizeCapitalizationRatePct(x) ?? 0).toFixed(2)} %`
      : '—';
  const fmtX = (x: number | null) =>
    x != null && Number.isFinite(x) ? `${x.toFixed(2)}×` : '—';

  return (
    <section className="rounded-xl border-2 border-sky-300 bg-sky-50/80 p-5 space-y-4">
      <div className="flex items-start gap-2">
        <Landmark className="h-5 w-5 text-sky-800 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-black text-sky-950">
            {t(
              'Vérification EEE — prudence bancaire (réserve remplacement)',
              'EEE verification — bank prudence (replacement reserve)'
            )}
          </p>
          <p className="text-[11px] text-sky-900/80 mt-1 flex items-start gap-1">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {L ? audit.reserveRuleLabelFr : audit.reserveRuleLabelEn}
            {audit.units > 0 ? ` — ${audit.units} ${t('unités', 'units')}.` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EeeMetric
          label={t('Revenu net déclaré (RNE)', 'Declared net operating income (NOI)')}
          value={fmt(audit.noiReported)}
        />
        <EeeMetric
          label={t('Revenu net normalisé (CFE)', 'Normalized NOI (CFE-adjusted)')}
          value={fmt(audit.noiNormalized)}
          highlight
        />
        <EeeMetric
          label={t('Taux de capitalisation (TGA) — déclaré', 'Cap rate — declared')}
          value={fmtPct(audit.capRateReported)}
        />
        <EeeMetric
          label={t('Taux de capitalisation (TGA) — normalisé', 'Cap rate — normalized')}
          value={fmtPct(audit.capRateNormalized)}
          highlight
        />
        <EeeMetric
          label={t('Ratio de couverture du service de la dette (DSCR) — déclaré', 'DSCR — declared')}
          value={fmtX(audit.dscrReported)}
        />
        <EeeMetric
          label={t('Ratio de couverture du service de la dette (DSCR) — normalisé', 'DSCR — normalized')}
          value={fmtX(audit.dscrNormalized)}
          highlight
        />
      </div>

      {audit.capexShortfall > 0 ? (
        <p className="text-[11px] font-bold text-sky-900">
          {t('Écart réserve théorique', 'Theoretical reserve gap')} : −{fmt(audit.capexShortfall)}
        </p>
      ) : null}

      {audit.alerts.length ? (
        <ul className="space-y-2">
          {audit.alerts.map((a) => (
            <li
              key={a.code}
              className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${
                a.severity === 'error'
                  ? 'bg-red-100 text-red-900 border border-red-200'
                  : 'bg-amber-100 text-amber-950 border border-amber-200'
              }`}
            >
              {L ? a.messageFr : a.messageEn}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function EeeMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-sky-200 bg-white px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-500 leading-snug">{label}</p>
      <p
        className={`mt-1 text-lg font-black tabular-nums ${
          highlight ? 'text-sky-900' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
