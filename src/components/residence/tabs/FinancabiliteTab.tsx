/**
 * Finançabilité commerciale — Vue bancaire lecture seule (Phase 3c).
 * SSOT : computeFinancabilite() + useFinancialData().
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Info, Landmark, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import {
  assessNoiDocumentationAdequacy,
  computeFinancabilite,
  DSCR_RULES,
  getMinimumDscrForProgram,
  SCHL_APH_SELECT_RULES,
} from '@primexpert/core/financial';
import { formatCurrency as formatCurrencyCore } from '@primexpert/core/utils/formatting';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { useFinanceHubLock } from '../../../context/FinanceHubLockContext';
import { ProvenanceStrip } from '../../financial/ProvenanceStrip';
import { FinancialAuditEeePanel } from '../../financial/FinancialAuditEeePanel';
import {
  inst,
  InstitutionalPageHeader,
  InstitutionalSection,
} from '../institutional/InstitutionalUi';
import type { Residence } from '../../../services/residences';

export interface FinancabiliteTabProps {
  residence: Residence;
}

/**
 * Toggle persistant (sessionStorage) — choix de la base RNE pour le scénario
 * bancaire. OFF : NOI Déclaré (brut vendeur). ON : NOI Audité (RBE enrichi
 * Phase 2.1 − dépenses normalisées). Cascade automatique sur EM / DSCR / MFR.
 */
const USE_AUDIT_RNE_STORAGE_KEY = 'primexpert-financabilite-useAuditRne';

function readUseAuditRneFromSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(USE_AUDIT_RNE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistUseAuditRne(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(USE_AUDIT_RNE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* sessionStorage indisponible : on reste sur l'état React local. */
  }
}

/** Seuils explicites demandés en consigne — autonomes par rapport au programme SCHL. */
const DSCR_CRITICAL_THRESHOLD = 1.2;
const DSCR_COMFORT_THRESHOLD = 1.3;

type ChecklistStatus = 'ok' | 'warn' | 'fail' | 'unknown';

interface ChecklistRow {
  id: string;
  labelFr: string;
  labelEn: string;
  status: ChecklistStatus;
  valueFr: string;
  valueEn: string;
  noteFr: string;
  noteEn: string;
}

type SellerVerdict = 'favorable' | 'conditionnel' | 'defavorable';

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

function AuditRneToggle({
  useAuditRne,
  onChange,
  language,
  noiDeclared,
  noiAudit,
  formatValue,
  disabled = false,
}: {
  useAuditRne: boolean;
  onChange: (next: boolean) => void;
  language: 'fr' | 'en';
  noiDeclared: number | null;
  noiAudit: number | null;
  formatValue: (n: number | null) => string;
  disabled?: boolean;
}) {
  const optionA = useAuditRne === false;
  const optionB = useAuditRne === true;
  const labelA = language === 'fr' ? 'A · Sur le RNE Déclaré' : 'A · Declared NOI basis';
  const labelB = language === 'fr' ? 'B · Sur le RNE normalisé (RPA enrichi)' : 'B · Normalized NOI (RPA enriched)';
  const subA = language === 'fr' ? 'Brut du vendeur (RNE rapporté).' : 'Seller-reported NOI.';
  const subB =
    language === 'fr'
      ? 'RBE enrichi (Phase 2.1) − dépenses normalisées.'
      : 'Enriched EGI (Phase 2.1) − normalized expenses.';
  return (
    <section
      className={cn(
        inst.section,
        'border-l-4 border-l-[#142c6a] bg-[#f1f5f9] p-5'
      )}
      aria-label={language === 'fr' ? 'Sélecteur de base RNE bancaire' : 'Bank NOI basis selector'}
    >
      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#142c6a]">
        {language === 'fr' ? 'Base de calcul bancaire' : 'Bank computation basis'}
      </p>
      <p className="mt-1 text-[15px] font-semibold leading-relaxed text-slate-800">
        {language === 'fr'
          ? 'Choisissez le RNE qui alimente le scénario : le tableau (EM / DSCR / MFR) se met à jour instantanément.'
          : 'Pick the NOI that powers the scenario: the table (max loan / DSCR / down payment) updates instantly.'}
      </p>

      <fieldset
        disabled={disabled}
        className="mt-4 grid gap-3 border-0 p-0 sm:grid-cols-2"
      >
        <legend className="sr-only">
          {language === 'fr' ? 'Choix RNE' : 'NOI choice'}
        </legend>
        <label
          className={cn(
            'flex cursor-pointer flex-col items-start gap-1 rounded-2xl border-2 px-5 py-4 text-left transition-colors',
            disabled && 'cursor-not-allowed opacity-60',
            optionA
              ? 'border-[#142c6a] bg-[#142c6a] text-white shadow-md'
              : 'border-[#142c6a]/30 bg-white text-[#142c6a] hover:border-[#142c6a]'
          )}
        >
          <input
            type="radio"
            id="finance-bank-noi-declared"
            name="finance-bank-noi-basis"
            checked={optionA}
            disabled={disabled}
            onChange={() => onChange(false)}
            className="sr-only"
          />
          <span className="text-[13px] font-black uppercase tracking-wider">{labelA}</span>
          <span
            className={cn(
              'text-[15px] font-bold tabular-nums',
              optionA ? 'text-white' : 'text-black'
            )}
          >
            {formatValue(noiDeclared)}
          </span>
          <span
            className={cn(
              'text-[13px] font-semibold leading-snug',
              optionA ? 'text-white/85' : 'text-slate-700'
            )}
          >
            {subA}
          </span>
        </label>
        <label
          className={cn(
            'flex cursor-pointer flex-col items-start gap-1 rounded-2xl border-2 px-5 py-4 text-left transition-colors',
            disabled && 'cursor-not-allowed opacity-60',
            optionB
              ? 'border-emerald-700 bg-emerald-700 text-white shadow-md'
              : 'border-emerald-700/30 bg-white text-emerald-900 hover:border-emerald-700'
          )}
        >
          <input
            type="radio"
            id="finance-bank-noi-audited"
            name="finance-bank-noi-basis"
            checked={optionB}
            disabled={disabled}
            onChange={() => onChange(true)}
            className="sr-only"
          />
          <span className="text-[13px] font-black uppercase tracking-wider">{labelB}</span>
          <span
            className={cn(
              'text-[15px] font-bold tabular-nums',
              optionB ? 'text-white' : 'text-black'
            )}
          >
            {formatValue(noiAudit)}
          </span>
          <span
            className={cn(
              'text-[13px] font-semibold leading-snug',
              optionB ? 'text-white/85' : 'text-slate-700'
            )}
          >
            {subB}
          </span>
        </label>
      </fieldset>
    </section>
  );
}

function statusIcon(status: ChecklistStatus): React.ReactNode {
  if (status === 'ok') return <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden />;
  if (status === 'warn') return <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden />;
  if (status === 'fail') return <XCircle className="h-5 w-5 text-red-700" aria-hidden />;
  return <Info className="h-5 w-5 text-slate-500" aria-hidden />;
}

function statusBadgeClasses(status: ChecklistStatus): string {
  if (status === 'ok') return 'border-emerald-700 bg-emerald-50 text-emerald-900';
  if (status === 'warn') return 'border-amber-500 bg-amber-50 text-amber-900';
  if (status === 'fail') return 'border-red-700 bg-red-50 text-red-900';
  return 'border-slate-400 bg-slate-50 text-slate-800';
}

function BankComplianceChecklist({
  rows,
  language,
}: {
  rows: ReadonlyArray<ChecklistRow>;
  language: 'fr' | 'en';
}) {
  return (
    <section
      className={cn(inst.section, 'border-l-4 border-l-amber-500 bg-white p-5')}
      aria-labelledby="bank-compliance-checklist-title"
    >
      <header className="mb-4">
        <p
          id="bank-compliance-checklist-title"
          className="text-[13px] font-black uppercase tracking-[0.18em] text-[#142c6a]"
        >
          {language === 'fr'
            ? 'Checklist de conformité bancaire'
            : 'Bank compliance checklist'}
        </p>
        <p className="mt-1 text-[15px] font-semibold leading-relaxed text-slate-800">
          {language === 'fr'
            ? 'Trois contrôles que tout prêteur appliquera avant d’engager le dossier.'
            : 'Three controls every lender will apply before committing.'}
        </p>
      </header>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn(
              'rounded-2xl border-2 p-4 shadow-sm',
              statusBadgeClasses(row.status)
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 shrink-0">{statusIcon(row.status)}</span>
                <div className="min-w-0">
                  <p className="text-[15px] font-black uppercase tracking-wider text-[#142c6a]">
                    {language === 'fr' ? row.labelFr : row.labelEn}
                  </p>
                  <p className="mt-1 text-[16px] font-bold tabular-nums text-black">
                    {language === 'fr' ? row.valueFr : row.valueEn}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[15px] font-semibold leading-relaxed text-black">
              {language === 'fr' ? row.noteFr : row.noteEn}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SellerVerdictPanel({
  verdict,
  language,
  ratio,
  minimumDscr,
  miseDeFonds,
  formatValue,
}: {
  verdict: SellerVerdict;
  language: 'fr' | 'en';
  ratio: number | null;
  minimumDscr: number;
  miseDeFonds: number | null;
  formatValue: (n: number | null) => string;
}) {
  const palette = {
    favorable: {
      border: 'border-emerald-700',
      ribbon: 'bg-emerald-700 text-white',
      icon: <ShieldCheck className="h-7 w-7" aria-hidden />,
      headlineFr: 'FAVORABLE — Finançable sans condition particulière',
      headlineEn: 'FAVORABLE — Financeable with no specific conditions',
    },
    conditionnel: {
      border: 'border-amber-500',
      ribbon: 'bg-amber-500 text-amber-950',
      icon: <ShieldAlert className="h-7 w-7" aria-hidden />,
      headlineFr: 'SOUS CONDITIONS — Mise de fonds renforcée probable',
      headlineEn: 'CONDITIONAL — Reinforced down payment likely',
    },
    defavorable: {
      border: 'border-red-700',
      ribbon: 'bg-red-700 text-white',
      icon: <XCircle className="h-7 w-7" aria-hidden />,
      headlineFr: 'DÉFAVORABLE — Capital acheteur majoré requis',
      headlineEn: 'UNFAVORABLE — Higher buyer equity required',
    },
  }[verdict];

  const ratioLabel = ratio != null && Number.isFinite(ratio) ? `${ratio.toFixed(2)}×` : '—';

  const bodyFr =
    verdict === 'favorable'
      ? `Le ratio de couverture (DSCR) retenu de ${ratioLabel} dépasse le seuil de confort bancaire (${DSCR_COMFORT_THRESHOLD.toFixed(2)}×). Le prêteur peut financer dans les ratios normaux et la mise de fonds requise reste au niveau attendu (${formatValue(miseDeFonds)}). Excellent argument de vente.`
      : verdict === 'conditionnel'
        ? `Le DSCR retenu de ${ratioLabel} se situe entre le minimum bancaire (${minimumDscr.toFixed(2)}×) et la zone de confort (${DSCR_COMFORT_THRESHOLD.toFixed(2)}×). Le prêteur réduira probablement l'emprunt maximal pour respecter ses ratios — l'acheteur devra donc injecter davantage d'équité (mise de fonds estimée : ${formatValue(miseDeFonds)}). Préparer un argumentaire de revenus annexes ou de garantie SCHL pour solidifier le dossier.`
        : `Le DSCR retenu de ${ratioLabel} est sous le minimum bancaire (${minimumDscr.toFixed(2)}×). Le prêteur ne couvrira pas le service de la dette aux paramètres demandés : l'acheteur devra majorer significativement sa mise de fonds (${formatValue(miseDeFonds)}) ou renégocier le prix à la baisse. Ce verdict ne ferme pas la transaction, mais il rallonge le cycle et exige un montage financier renforcé.`;

  const bodyEn =
    verdict === 'favorable'
      ? `Retained DSCR of ${ratioLabel} clears the bank comfort threshold (${DSCR_COMFORT_THRESHOLD.toFixed(2)}×). The lender can finance within standard ratios and the required down payment stays in line (${formatValue(miseDeFonds)}). Strong selling argument.`
      : verdict === 'conditionnel'
        ? `Retained DSCR of ${ratioLabel} sits between the minimum (${minimumDscr.toFixed(2)}×) and comfort zone (${DSCR_COMFORT_THRESHOLD.toFixed(2)}×). The lender is likely to trim the maximum loan to honor its ratios — the buyer will need extra equity (estimated down payment: ${formatValue(miseDeFonds)}). Prepare ancillary income evidence or a CMHC guarantee to strengthen the file.`
        : `Retained DSCR of ${ratioLabel} is below the bank minimum (${minimumDscr.toFixed(2)}×). The lender will not cover debt service at the requested parameters: the buyer must raise the down payment significantly (${formatValue(miseDeFonds)}) or renegotiate the price down. This verdict doesn't end the deal, but it lengthens the cycle and demands a reinforced financing structure.`;

  return (
    <section
      className={cn(
        inst.section,
        'border-2 bg-white p-0 overflow-hidden',
        palette.border
      )}
      aria-labelledby="seller-verdict-title"
    >
      <header
        className={cn(
          'flex items-center gap-3 px-5 py-3 text-[14px] font-black uppercase tracking-[0.18em]',
          palette.ribbon
        )}
      >
        {palette.icon}
        <p id="seller-verdict-title">
          {language === 'fr' ? 'Verdict pour le vendeur' : 'Seller verdict'}
        </p>
      </header>
      <div className="px-5 py-5">
        <p className="text-[18px] font-black uppercase tracking-wide text-[#142c6a]">
          {language === 'fr' ? palette.headlineFr : palette.headlineEn}
        </p>
        <p className="mt-4 text-[16px] font-semibold leading-relaxed text-black">
          {language === 'fr' ? bodyFr : bodyEn}
        </p>
      </div>
    </section>
  );
}

export function FinancabiliteTab({ residence }: FinancabiliteTabProps) {
  const { t, language } = useLanguage();
  const { financialData, loading, error, isInProvider } = useFinancialData();
  const { inputsLocked } = useFinanceHubLock();

  const [useAuditRne, setUseAuditRne] = useState<boolean>(() => readUseAuditRneFromSession());
  const handleToggleUseAuditRne = useCallback((next: boolean) => {
    setUseAuditRne(next);
    persistUseAuditRne(next);
  }, []);

  const residenceHints = useMemo(
    () => ({
      ...residence,
      prixDemande: residence.price,
      askingPrice: residence.price,
    }),
    [residence]
  );

  const fmt = useCallback(
    (n: number | null) =>
      n != null && Number.isFinite(n) ? formatCurrencyCore(n, { fallback: '—' }) : '—',
    []
  );

  const model = useMemo(
    () =>
      computeFinancabilite(financialData, residenceHints, {
        formatCurrency: fmt,
        useAuditNoi: useAuditRne,
      }),
    [financialData, residenceHints, fmt, useAuditRne]
  );

  const safeLanguage: 'fr' | 'en' = language === 'fr' ? 'fr' : 'en';

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

  const minimumDscr = getMinimumDscrForProgram(
    model.financingProgramId,
    model.propertyAssetCategory
  );

  const checklistRows: ReadonlyArray<ChecklistRow> = (() => {
    const ratio = model.ratioCouverture;
    const ratioLabel =
      ratio != null && Number.isFinite(ratio) ? `${ratio.toFixed(2)}×` : '—';

    const criticalStatus: ChecklistStatus =
      ratio == null || !Number.isFinite(ratio)
        ? 'unknown'
        : ratio >= DSCR_CRITICAL_THRESHOLD
          ? 'ok'
          : 'fail';
    const confortStatus: ChecklistStatus =
      ratio == null || !Number.isFinite(ratio)
        ? 'unknown'
        : ratio >= DSCR_COMFORT_THRESHOLD
          ? 'ok'
          : 'warn';

    const noiAudit = model.noiAudit;
    const noiDeclared = model.noiDeclare;
    const noiAssessment = assessNoiDocumentationAdequacy(noiAudit, noiDeclared);
    const noiStatus: ChecklistStatus = noiAssessment.status;
    let noiNoteFr = 'Aucune donnée RNE disponible — compléter Revenus & Dépenses.';
    let noiNoteEn = 'No NOI data available — complete Revenue & Expenses.';
    if (noiAssessment.hasNormalizedNoi && noiAssessment.hasDeclaredNoi) {
      const variancePct = noiAssessment.variancePct?.toFixed(1) ?? '0.0';
      if (noiAssessment.status === 'ok') {
        noiNoteFr =
          'RNE déclaré et RNE normalisé concordent (écart ≤ 5 %). Pièces justificatives en ordre côté prêteur.';
        noiNoteEn =
          'Declared and normalized NOI match (≤ 5% variance). Supporting evidence is aligned with lender expectations.';
      } else if (noiAssessment.status === 'warn') {
        noiNoteFr = `Écart de ${variancePct} % entre RNE déclaré et RNE normalisé — justifier la normalisation des dépenses.`;
        noiNoteEn = `${variancePct}% gap between declared and normalized NOI — justify expense normalization.`;
      } else {
        noiNoteFr = `Écart majeur de ${variancePct} % entre RNE déclaré et RNE normalisé — vérifier les sources avant présentation prêteur.`;
        noiNoteEn = `Major ${variancePct}% gap between declared and normalized NOI — validate sources before lender submission.`;
      }
    } else if (noiAssessment.hasNormalizedNoi) {
      noiNoteFr =
        'Seul le RNE normalisé (calculé) est disponible — manque la déclaration vendeur pour pleinement convaincre le prêteur.';
      noiNoteEn =
        'Only normalized NOI (computed) is available — missing seller statement to fully convince the lender.';
    } else if (noiAssessment.hasDeclaredNoi) {
      noiNoteFr =
        'Seul le RNE déclaré est disponible — recommander une normalisation par dépenses vérifiées.';
      noiNoteEn =
        'Only declared NOI is available — recommend normalization with verified expenses.';
    }

    return [
      {
        id: 'dscr_critical',
        labelFr: `DSCR bancaire critique (≥ ${DSCR_CRITICAL_THRESHOLD.toFixed(2)}×)`,
        labelEn: `Critical bank DSCR (≥ ${DSCR_CRITICAL_THRESHOLD.toFixed(2)}×)`,
        status: criticalStatus,
        valueFr: ratioLabel,
        valueEn: ratioLabel,
        noteFr:
          criticalStatus === 'ok'
            ? `Le service de la dette est couvert au-dessus du seuil minimal exigé par les prêteurs commerciaux.`
            : criticalStatus === 'fail'
              ? `Le DSCR retenu de ${ratioLabel} est sous le seuil critique (${DSCR_CRITICAL_THRESHOLD.toFixed(2)}×) — refus probable sans réduction du prêt.`
              : 'Données insuffisantes pour vérifier le seuil critique.',
        noteEn:
          criticalStatus === 'ok'
            ? `Debt service clears the minimum threshold required by commercial lenders.`
            : criticalStatus === 'fail'
              ? `Retained DSCR of ${ratioLabel} is below the critical threshold (${DSCR_CRITICAL_THRESHOLD.toFixed(2)}×) — likely refusal without loan reduction.`
              : 'Insufficient data to verify the critical threshold.',
      },
      {
        id: 'dscr_comfort',
        labelFr: `DSCR de confort couvert (≥ ${DSCR_COMFORT_THRESHOLD.toFixed(2)}×)`,
        labelEn: `Comfort DSCR covered (≥ ${DSCR_COMFORT_THRESHOLD.toFixed(2)}×)`,
        status: confortStatus,
        valueFr: ratioLabel,
        valueEn: ratioLabel,
        noteFr:
          confortStatus === 'ok'
            ? `Marge de sécurité confortable : le prêteur n'imposera pas de contre-conditions liées au DSCR.`
            : confortStatus === 'warn'
              ? `DSCR sous la zone de confort — le prêteur conservera des marges (LTV plus serrée, MFR majorée).`
              : 'Données insuffisantes pour vérifier le seuil de confort.',
        noteEn:
          confortStatus === 'ok'
            ? `Comfortable safety margin: no DSCR-driven counter-conditions expected.`
            : confortStatus === 'warn'
              ? `DSCR below comfort zone — the lender will tighten ratios (lower LTV, higher down payment).`
              : 'Insufficient data to verify the comfort threshold.',
      },
      {
        id: 'noi_evidence',
        labelFr: 'Adéquation du RNE documenté',
        labelEn: 'Documented NOI adequacy',
        status: noiStatus,
        valueFr: `${fmt(noiDeclared)} · ${fmt(noiAudit)}`,
        valueEn: `${fmt(noiDeclared)} · ${fmt(noiAudit)}`,
        noteFr: noiNoteFr,
        noteEn: noiNoteEn,
      },
    ];
  })();

  const sellerVerdict: SellerVerdict = (() => {
    const ratio = model.ratioCouverture;
    if (ratio == null || !Number.isFinite(ratio)) return 'conditionnel';
    if (ratio < minimumDscr) return 'defavorable';
    if (ratio < DSCR_COMFORT_THRESHOLD) return 'conditionnel';
    return 'favorable';
  })();

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

      <AuditRneToggle
        useAuditRne={useAuditRne}
        onChange={handleToggleUseAuditRne}
        language={safeLanguage}
        noiDeclared={model.noiDeclare}
        noiAudit={model.noiAudit}
        formatValue={fmt}
        disabled={inputsLocked}
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

      <FinancialAuditEeePanel
        residence={residence}
        prixDemande={model.prixDemande ?? residence.price}
        paiementAnnuelDette={model.paiementAnnuel ?? 0}
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

      <div className={cn(inst.kpi, 'border-2 border-[#142c6a] p-6')}>
        <p className={inst.kpiLabel}>
          {t(
            'Emprunt maximum autorisé (le plus bas des critères)',
            'Maximum authorized loan (lowest of criteria)'
          )}
        </p>
        <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-[#142c6a]">
          {fmt(model.empruntMaxTransaction)}
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-700">
          {t(
            'Mise de fonds requise (MFR) — prix demandé moins emprunt retenu :',
            'Required down payment (RFR) — asking price minus retained loan:'
          )}{' '}
          <span className="font-black text-black">{fmt(model.miseDeFondsRequise)}</span>
        </p>
        <p className="mt-2 text-[11px] text-slate-600">
          {t(
            'Détail des critères (ratio de couverture (DSCR) vs ratio prêt-valeur (RPV)) — voir tableau ci-dessous.',
            'Criteria detail (debt service coverage ratio (DSCR) vs loan-to-value (LTV)) — see table below.'
          )}
        </p>
      </div>

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

      <BankComplianceChecklist rows={checklistRows} language={safeLanguage} />

      <SellerVerdictPanel
        verdict={sellerVerdict}
        language={safeLanguage}
        ratio={model.ratioCouverture}
        minimumDscr={minimumDscr}
        miseDeFonds={model.miseDeFondsRequise ?? null}
        formatValue={fmt}
      />

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
