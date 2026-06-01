/**
 * Saisie manuelle Hub Finance — enrichit financial/dataV2 (SSOT).
 * Complète imports / parse IA ; ne remplace pas Revenus & Dépenses (normalisation).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Keyboard, Loader2, Save } from 'lucide-react';
import { EXPENSE_FIELDS } from '@primexpert/core/financial';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { useFinancialHubDraft } from '../../../context/FinancialHubDraftContext';
import { useFinanceHubLock } from '../../../context/FinanceHubLockContext';
import { useInstitutionalToast } from '../../../hooks/useInstitutionalToast';
import {
  manualFinancialEntryDraftFromData,
  saveManualFinancialEntry,
  type ManualFinancialEntryDraft,
} from '../../../services/financialDataService';
import { inst } from '../institutional/InstitutionalUi';
import type { Residence } from '../../../services/residences';
import { useResidenceFinancialHints } from '../../../context/ResidenceDataContext';

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right font-mono text-sm font-semibold text-[#142c6a] tabular-nums focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40';

const LABEL_CLASS = 'text-xs font-semibold text-[#142c6a] leading-snug';

export interface FinanceManualEntryPanelProps {
  residence: Residence;
  /** Ouvre le panneau par défaut si aucune donnée V2. */
  defaultExpanded?: boolean;
}

function ManualField({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {hint ? <p className="text-[10px] text-slate-500">{hint}</p> : null}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
        placeholder="—"
      />
    </div>
  );
}

export function FinanceManualEntryPanel({
  residence,
  defaultExpanded = false,
}: FinanceManualEntryPanelProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { financialData, loading, residenceId, isInProvider } = useFinancialData();
  const {
    pendingIaReview,
    pendingDraft,
    iaMeta,
    clearIaPending,
    expandManualPanel,
    consumeExpandManualPanel,
  } = useFinancialHubDraft();
  const { inputsLocked } = useFinanceHubLock();
  const { showSuccess, showError } = useInstitutionalToast();
  const financialHints = useResidenceFinancialHints(residence);
  const listingPrice = financialHints.prixDemande ?? residence.price;

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [draft, setDraft] = useState<ManualFinancialEntryDraft>(() =>
    manualFinancialEntryDraftFromData(null)
  );
  const [saving, setSaving] = useState(false);

  const unitHint = useMemo(
    () =>
      residence.nicheMetadata?.rpaFields?.units ??
      residence.nicheMetadata?.plexFields?.units ??
      null,
    [residence]
  );

  useEffect(() => {
    if (pendingIaReview && pendingDraft) {
      setDraft(pendingDraft);
      setExpanded(true);
      return;
    }
    setDraft(
      manualFinancialEntryDraftFromData(financialData, { nombreUnites: unitHint })
    );
  }, [financialData, unitHint, pendingIaReview, pendingDraft]);

  useEffect(() => {
    if (expandManualPanel && consumeExpandManualPanel()) {
      setExpanded(true);
    }
  }, [expandManualPanel, consumeExpandManualPanel]);

  useEffect(() => {
    if (!loading && defaultExpanded) setExpanded(true);
  }, [loading, defaultExpanded]);

  const setDepense = useCallback((key: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      depenses: { ...prev.depenses, [key]: value },
    }));
  }, []);

  const setFinancement = useCallback(
    (key: keyof ManualFinancialEntryDraft['financement'], value: string) => {
      setDraft((prev) => ({
        ...prev,
        financement: { ...prev.financement, [key]: value },
      }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!residenceId || inputsLocked) return;
    const rbe = parseFloat(String(draft.revenusAnnuels).replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(rbe) || rbe <= 0) {
      showError(
        locale === 'fr'
          ? 'Saisissez un revenu brut effectif (RBE) annuel valide.'
          : 'Enter a valid annual effective gross income (EGI).'
      );
      return;
    }
    const wasIaReview = pendingIaReview;
    setSaving(true);
    try {
      await saveManualFinancialEntry(residenceId, financialData, draft, listingPrice, {
        humanValidatedFromIa: wasIaReview,
        sourceDocumentId: iaMeta?.documentId,
      });
      if (wasIaReview) clearIaPending();
      showSuccess(
        locale === 'fr'
          ? wasIaReview
            ? 'Données IA approuvées et enregistrées'
            : 'Données financières enregistrées (saisie manuelle)'
          : wasIaReview
            ? 'AI data approved and saved'
            : 'Financial data saved (manual entry)'
      );
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [
    residenceId,
    inputsLocked,
    draft,
    financialData,
    listingPrice,
    locale,
    showSuccess,
    showError,
    pendingIaReview,
    iaMeta?.documentId,
    clearIaPending,
  ]);

  if (!isInProvider) return null;

  const disabled = inputsLocked || loading || saving;

  return (
    <section
      className={cn(
        inst.section,
        'mx-5 mt-4 border-l-4 border-l-[#D4AF37]',
        inputsLocked && 'opacity-90'
      )}
      aria-labelledby="finance-manual-entry-heading"
    >
      <div className={cn(inst.sectionHeader, 'flex flex-wrap items-center justify-between gap-3')}>
        <div className="flex items-center gap-2 min-w-0">
          <Keyboard className="h-4 w-4 text-[#142c6a] shrink-0" aria-hidden />
          <div>
            <h2 id="finance-manual-entry-heading" className={inst.sectionTitle}>
              {t('Saisie manuelle', 'Manual entry')}
            </h2>
            <p className="text-[11px] text-slate-600 mt-0.5 font-medium normal-case tracking-normal">
              {t(
                'Entrer ou forcer les chiffres — complète les imports et la normalisation.',
                'Enter or override figures — complements imports and normalization.'
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#142c6a] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#142c6a] hover:bg-[#f1f5f9]"
          onClick={() => setExpanded((o) => !o)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              {t('Replier', 'Collapse')}
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              {t('Entrer manuellement', 'Enter manually')}
            </>
          )}
        </button>
      </div>

      {expanded ? (
        <div
          className={cn(
            'p-5 space-y-6',
            inputsLocked && 'pointer-events-none select-none'
          )}
        >
          {pendingIaReview ? (
            <div
              className="rounded-xl border-2 border-amber-400/80 bg-amber-50 px-4 py-3"
              role="status"
            >
              <p className="text-sm font-bold text-[#142c6a]">
                {t(
                  'Données extraites par l’IA : veuillez réviser et approuver',
                  'AI-extracted data: please review and approve'
                )}
              </p>
              {iaMeta?.fileName ? (
                <p className="mt-1 text-[11px] text-slate-600 font-medium">
                  {t('Source', 'Source')} : {iaMeta.fileName}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-slate-600">
                {t(
                  'Aucun chiffre n’est officiel tant que vous n’avez pas cliqué sur « Enregistrer la saisie ».',
                  'No figure is official until you click « Save entry ».'
                )}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ManualField
              id="manual-rbe"
              label={t('Revenu brut effectif (RBE) — annuel', 'Effective gross income (EGI) — annual')}
              value={draft.revenusAnnuels}
              onChange={(v) => setDraft((p) => ({ ...p, revenusAnnuels: v }))}
              disabled={disabled}
            />
            <ManualField
              id="manual-unites"
              label={t('Nombre d’unités / places', 'Number of units / beds')}
              value={draft.nombreUnites}
              onChange={(v) => setDraft((p) => ({ ...p, nombreUnites: v }))}
              disabled={disabled}
            />
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">
              {t(
                'Dépenses d’exploitation déclarées (annuelles)',
                'Declared operating expenses (annual)'
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {EXPENSE_FIELDS.map((field) => {
                const key = String(field.key);
                const label = locale === 'fr' ? field.label : field.labelEn;
                return (
                  <ManualField
                    key={key}
                    id={`manual-dep-${key}`}
                    label={label}
                    value={draft.depenses[key] ?? ''}
                    onChange={(v) => setDepense(key, v)}
                    disabled={disabled}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">
              {t('Financement institutionnel', 'Institutional financing')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ManualField
                id="manual-solde"
                label={t('Solde hypothécaire', 'Mortgage balance')}
                value={draft.financement.soldeHypothecaire}
                onChange={(v) => setFinancement('soldeHypothecaire', v)}
                disabled={disabled}
              />
              <ManualField
                id="manual-taux"
                label={t('Taux d’intérêt (%)', 'Interest rate (%)')}
                value={draft.financement.tauxInteret}
                onChange={(v) => setFinancement('tauxInteret', v)}
                disabled={disabled}
              />
              <ManualField
                id="manual-penalite"
                label={t('Pénalité de remboursement', 'Prepayment penalty')}
                value={draft.financement.penaliteRemboursement}
                onChange={(v) => setFinancement('penaliteRemboursement', v)}
                disabled={disabled}
              />
              <ManualField
                id="manual-mensualite"
                label={t('Mensualité', 'Monthly payment')}
                value={draft.financement.paiementMensuel}
                onChange={(v) => setFinancement('paiementMensuel', v)}
                disabled={disabled}
              />
              <ManualField
                id="manual-amort"
                label={t('Amortissement (années)', 'Amortization (years)')}
                value={draft.financement.amortissement}
                onChange={(v) => setFinancement('amortissement', v)}
                disabled={disabled}
              />
              <ManualField
                id="manual-dscr"
                label={t('Ratio de couverture de la dette (CCD) cible', 'Target debt service coverage ratio (DSCR)')}
                value={draft.financement.dscr}
                onChange={(v) => setFinancement('dscr', v)}
                disabled={disabled}
                hint={t('Ex. 1,25', 'e.g. 1.25')}
              />
              <ManualField
                id="manual-tga-preteur"
                label={t('Taux de capitalisation (TGA) prêteur (%)', 'Lender cap rate (%)')}
                value={draft.financement.tgaPreteur}
                onChange={(v) => setFinancement('tgaPreteur', v)}
                disabled={disabled}
              />
            </div>
          </div>

          <p className={inst.note}>
            {t(
              'Les montants enregistrés alimentent financial/dataV2. Utilisez l’onglet Revenus & Dépenses pour ajuster la colonne « Normalisé » après import.',
              'Saved amounts feed financial/dataV2. Use the Revenue & Expenses tab to adjust the « Normalized » column after import.'
            )}
          </p>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (pendingIaReview) {
                  clearIaPending();
                }
                setDraft(
                  manualFinancialEntryDraftFromData(financialData, {
                    nombreUnites: unitHint,
                  })
                );
              }}
              className="rounded-lg border border-[#142c6a]/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#142c6a] hover:bg-slate-50 disabled:opacity-50"
            >
              {t('Réinitialiser', 'Reset')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-[#142c6a] bg-[#142c6a] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#1e3d8f] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {saving ? t('Enregistrement…', 'Saving…') : t('Enregistrer la saisie', 'Save entry')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
