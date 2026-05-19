/**
 * Finançabilité commerciale — Vue bancaire lecture seule (Phase 3c).
 * SSOT : computeFinancabilite() + useFinancialData().
 */

import React, { useMemo } from 'react';
import { Building2, Info, Landmark } from 'lucide-react';
import {
  computeFinancabilite,
  DSCR_RULES,
  getMinimumDscrForProgram,
  SCHL_APH_SELECT_RULES,
} from '@primexpert/core/financial';
import { formatCurrency as formatCurrencyCore } from '@primexpert/core/utils/formatting';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { ProvenanceStrip } from '../../financial/ProvenanceStrip';
import {
  inst,
  InstitutionalPageHeader,
  InstitutionalSection,
} from '../institutional/InstitutionalUi';
import type { Residence } from '../../../services/residences';

export interface FinancabiliteTabProps {
  residence: Residence;
}

function DscrGauge({
  ratio,
  target,
  minimumDscr,
  verdictColor,
  labelFr,
  labelEn,
  language,
}: {
  ratio: number | null;
  target: number;
  minimumDscr: number;
  verdictColor: string;
  labelFr: string;
  labelEn: string;
  language: string;
}) {
  const maxScale = Math.max(DSCR_RULES.EXCELLENT, (ratio ?? 0) * 1.1, target * 1.1);
  const pct = ratio != null && maxScale > 0 ? Math.min(100, (ratio / maxScale) * 100) : 0;
  const targetPct = (target / maxScale) * 100;
  const minPct = (minimumDscr / maxScale) * 100;

  return (
    <div className={cn(inst.kpi, 'p-6')}>
      <p className={inst.kpiLabel}>{language === 'fr' ? 'Jauge DSCR' : 'DSCR gauge'}</p>
      <div className="flex items-end justify-between gap-4 mb-3 mt-2">
        <p className="text-4xl font-black tracking-tight text-[#142c6a] tabular-nums">
          {ratio != null ? `${ratio.toFixed(2)}×` : '—'}
        </p>
        <p className="text-sm font-semibold text-slate-600 text-right">
          {language === 'fr' ? labelFr : labelEn}
        </p>
      </div>
      <div className="relative h-3 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: verdictColor }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-500"
          style={{ left: `${minPct}%` }}
          title={`Min ${minimumDscr}×`}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-800"
          style={{ left: `${targetPct}%` }}
          title={`Cible ${target.toFixed(2)}×`}
        />
      </div>
      <div className="flex justify-between mt-2 text-[9px] font-mono text-slate-600">
        <span>0×</span>
        <span>Min {minimumDscr.toFixed(2)}×</span>
        <span>
          {language === 'fr' ? `Cible ${target.toFixed(2)}×` : `Target ${target.toFixed(2)}×`}
        </span>
      </div>
    </div>
  );
}

export function FinancabiliteTab({ residence }: FinancabiliteTabProps) {
  const { t, language } = useLanguage();
  const { financialData, loading, error, isInProvider } = useFinancialData();

  const residenceHints = useMemo(
    () => ({
      ...residence,
      prixDemande: residence.price,
      askingPrice: residence.price,
    }),
    [residence]
  );

  const fmt = (n: number | null) =>
    n != null && Number.isFinite(n) ? formatCurrencyCore(n, { fallback: '—' }) : '—';

  const model = useMemo(
    () =>
      computeFinancabilite(financialData, residenceHints, {
        formatCurrency: fmt,
      }),
    [financialData, residenceHints]
  );

  if (!isInProvider) {
    return <div className={inst.alertAmber}>{t('Provider financier manquant.', 'Financial provider missing.')}</div>;
  }

  if (loading) {
    return (
      <div className={inst.loading}>
        <p className={inst.loadingText}>{t('Chargement de la vue bancaire…', 'Loading bank view…')}</p>
      </div>
    );
  }

  if (error) {
    return <div className={inst.alertRed}>{error.message}</div>;
  }

  if (!model.hasFinancials || !model.hasValidInputs) {
    return (
      <div className={cn(inst.section, 'p-6')}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
          <div>
            <p className={inst.pageTitle}>{t('Finançabilité commerciale', 'Commercial financing')}</p>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              {t(
                'Données insuffisantes pour un scénario bancaire (prix demandé et revenu net d’exploitation (RNE) requis). Complétez la grille Revenus & Dépenses ou migrez financial/dataV2 depuis Copilote.',
                'Insufficient data for a bank scenario (asking price and net operating income (NOI) required). Complete Revenue & Expenses or migrate financial/dataV2.'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const verdictBorder =
    model.financingVerdict === 'financable' ? 'border-l-emerald-600' : 'border-l-amber-500';

  return (
    <div className={cn('space-y-5', inst.page)}>
      <InstitutionalPageHeader
        icon={<Landmark className="h-5 w-5 text-slate-700 shrink-0" />}
        title={t('Vue bancaire · Scénario institutionnel', 'Bank view · Institutional scenario')}
      />

      <ProvenanceStrip
        lastUpdated={model.provenance.lastUpdated}
        source={model.provenance.source}
        confidenceTier={model.provenance.confidenceTier}
      />

      <div className={cn(inst.kpi, 'border-l-4', verdictBorder, 'p-6')}>
        <div className="flex flex-wrap items-center gap-4">
          <Building2 className="h-10 w-10 text-slate-700 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black text-[#142c6a] tracking-tight">
              {language === 'fr' ? model.financingLabelFr : model.financingLabelEn}
            </p>
            <p className="text-sm text-slate-700 mt-1 leading-relaxed">
              {language === 'fr' ? model.financingDescriptionFr : model.financingDescriptionEn}
            </p>
          </div>
        </div>
      </div>

      <DscrGauge
        ratio={model.ratioCouverture}
        target={model.dscrCible}
        minimumDscr={getMinimumDscrForProgram(
          model.financingProgramId,
          model.propertyAssetCategory
        )}
        verdictColor={model.dscrVerdict.color}
        labelFr={model.dscrVerdict.labelFr}
        labelEn={model.dscrVerdict.labelEn}
        language={language}
      />

      {model.aphSelectEligibility && (
        <InstitutionalSection
          title={
            language === 'fr'
              ? 'Programme APH Select (assistance en logement privé)'
              : 'APH Select program (assisted private housing)'
          }
        >
          <p className="text-sm font-bold text-[#142c6a]" style={{ color: model.aphSelectEligibility.overallColor }}>
            {language === 'fr'
              ? model.aphSelectEligibility.overallLabelFr
              : model.aphSelectEligibility.overallLabelEn}
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
            {model.aphSelectEligibility.criteria.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>{language === 'fr' ? c.labelFr : c.labelEn}</span>
                <span
                  className={cn(
                    'shrink-0 font-semibold text-[#142c6a]',
                    c.status === 'conforme' && 'text-emerald-700',
                    c.status === 'hors_normes' && 'text-red-700',
                    c.status === 'a_verifier' && 'text-amber-700'
                  )}
                >
                  {c.status === 'conforme'
                    ? language === 'fr'
                      ? 'Conforme'
                      : 'OK'
                    : c.status === 'hors_normes'
                      ? language === 'fr'
                        ? 'Hors-normes'
                        : 'Fail'
                      : language === 'fr'
                        ? 'À vérifier'
                        : 'Review'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-slate-600">
            {language === 'fr'
              ? `Points : abordabilité, efficacité énergétique, accessibilité (min. ${SCHL_APH_SELECT_RULES.MIN_POINTS_FOR_BENEFITS} pts).`
              : `Points: affordability, energy efficiency, accessibility (min. ${SCHL_APH_SELECT_RULES.MIN_POINTS_FOR_BENEFITS} pts).`}{' '}
            <a
              href={SCHL_APH_SELECT_RULES.OFFICIAL_URLS.APH_SELECT_FR}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-800 underline font-semibold"
            >
              {language === 'fr'
                ? 'Fiche APH Select — Société canadienne d’hypothèques et de logement (SCHL)'
                : 'APH Select sheet — Canada Mortgage and Housing Corporation (CMHC)'}
            </a>
          </p>
        </InstitutionalSection>
      )}

      <section className={inst.section}>
        <header className={inst.sectionHeader}>
          <h3 className={inst.sectionTitle}>{t('Scénario de financement', 'Financing scenario')}</h3>
        </header>
        <table className={inst.table}>
          <tbody>
            {model.scenarioRows.map((row) => (
              <tr key={row.labelFr} className={cn(inst.tr, row.highlight && 'bg-slate-50')}>
                <td className={inst.td}>{language === 'fr' ? row.labelFr : row.labelEn}</td>
                <td className={cn(inst.tdValueMono, row.highlight && 'font-black')}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="space-y-1 px-1 text-[10px] text-slate-600 italic">
        <p>{language === 'fr' ? model.dscrVerdict.descriptionFr : model.dscrVerdict.descriptionEn}</p>
        <p style={{ color: model.amortissementVerdict.color }}>
          {language === 'fr'
            ? model.amortissementVerdict.descriptionFr
            : model.amortissementVerdict.descriptionEn}
        </p>
      </div>
    </div>
  );
}
