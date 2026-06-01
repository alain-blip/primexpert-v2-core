/**
 * Sauvegarde financial/dataV2 — ajustements CPA (colonne Normalisé).
 */

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  EXPENSE_FIELDS,
  EXPENSE_KEYS,
  mergeExtractedIntoFinancialDataV2,
  recomputeFinancialCalculatedResults,
  resolveCapitalizationRateFromRne,
  resolveCanonicalFinancialMetrics,
  sumNormalizedOperatingExpenses,
  type FinancialBaseData,
  type FinancialDataV2Doc,
} from '@primexpert/core/financial';
import type { ExtractedAmountRow } from '../lib/extractedDataInjection';
import { db } from '../lib/firebase';
import { stripUndefinedDeep } from '../lib/firestoreSanitize';

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export interface ExpenseAdjustmentsDraft {
  byKey: Record<string, string | number>;
  autresDepenses: Array<string | number>;
}

export function expenseAdjustmentsDraftFromFinancial(
  financialData: FinancialDataV2Doc | null
): ExpenseAdjustmentsDraft {
  const raw = (financialData?.baseData?.expenseAdjustments ?? {}) as Record<string, unknown>;
  const byKey: Record<string, string | number> = {};
  for (const k of EXPENSE_KEYS) {
    const v = raw[k];
    byKey[k] = v != null && v !== '' ? String(v) : '';
  }
  const dep = financialData?.baseData?.depenses;
  const autresCount = Array.isArray(dep?.autresDepenses) ? dep.autresDepenses.length : 0;
  const arr = Array.isArray(raw.autresDepenses) ? raw.autresDepenses : [];
  const autresDepenses: Array<string | number> = [];
  for (let i = 0; i < autresCount; i += 1) {
    autresDepenses.push(arr[i] != null && arr[i] !== '' ? String(arr[i]) : '');
  }
  return { byKey, autresDepenses };
}

export function buildExpenseAdjustmentsForFirestore(
  draft: ExpenseAdjustmentsDraft,
  existingVerified?: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { autresDepenses: [], verified: existingVerified ?? {} };
  for (const k of EXPENSE_KEYS) {
    out[k] = parseNum(draft.byKey[k]);
  }
  for (const v of draft.autresDepenses) {
    (out.autresDepenses as number[]).push(parseNum(v));
  }
  return out;
}

export async function saveExpenseAdjustmentsToFinancial(
  residenceId: string,
  financialData: FinancialDataV2Doc,
  draft: ExpenseAdjustmentsDraft
): Promise<void> {
  const dep = financialData.baseData?.depenses ?? {};
  const existingVerified = (
    (financialData.baseData?.expenseAdjustments as Record<string, unknown> | undefined)?.verified ??
    {}
  ) as Record<string, unknown>;

  const adjFirestore = buildExpenseAdjustmentsForFirestore(draft, existingVerified);

  const depensesTotalesNormalisees =
    sumNormalizedOperatingExpenses(dep, adjFirestore) ?? 0;
  const rbe =
    parseNum(financialData.calculatedResults?.revenuBrutEffectif) ||
    parseNum(financialData.baseData?.revenusAnnuels);
  const canonicalMetrics = resolveCanonicalFinancialMetrics(
    {
      ...(financialData.calculatedResults ?? {}),
      ...(rbe > 0 ? { revenuBrutEffectif: rbe, revenusAnnuels: rbe } : {}),
    },
    {
      ...(financialData.baseData ?? {}),
      depenses: dep,
      expenseAdjustments: adjFirestore,
    }
  );
  const revenuNetExploitation = canonicalMetrics.rne;

  const prixDemande = parseNum(
    (financialData.calculatedResults as Record<string, unknown> | undefined)?.prixDemande
  );
  const tauxCapitalisation =
    resolveCapitalizationRateFromRne(revenuNetExploitation, prixDemande) ?? undefined;

  const docRef = doc(db, 'residences', residenceId, 'financial', 'dataV2');
  await setDoc(
    docRef,
    stripUndefinedDeep({
      baseData: {
        ...(financialData.baseData ?? {}),
        expenseAdjustments: adjFirestore,
      },
      lastUpdated: serverTimestamp(),
      calculatedResults: {
        ...(financialData.calculatedResults ?? {}),
        depensesTotalesNormalisees,
        revenuNetExploitation,
        ...(tauxCapitalisation != null ? { tauxCapitalisation } : {}),
      },
    }),
    { merge: true }
  );
}

/** Champs financement institutionnel — saisie manuelle Hub Finance. */
export interface ManualFinancementDraft {
  soldeHypothecaire: string;
  tauxInteret: string;
  penaliteRemboursement: string;
  paiementMensuel: string;
  amortissement: string;
  dscr: string;
  tgaPreteur: string;
}

export interface ManualFinancialEntryDraft {
  revenusAnnuels: string;
  nombreUnites: string;
  depenses: Record<string, string>;
  financement: ManualFinancementDraft;
}

const MANUAL_FINANCEMENT_KEYS: (keyof ManualFinancementDraft)[] = [
  'soldeHypothecaire',
  'tauxInteret',
  'penaliteRemboursement',
  'paiementMensuel',
  'amortissement',
  'dscr',
  'tgaPreteur',
];

function emptyManualFinancementDraft(): ManualFinancementDraft {
  return {
    soldeHypothecaire: '',
    tauxInteret: '',
    penaliteRemboursement: '',
    paiementMensuel: '',
    amortissement: '',
    dscr: '',
    tgaPreteur: '',
  };
}

function formatDraftNum(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n !== 0 ? String(Math.round(n)) : '';
}

export function manualFinancialEntryDraftFromData(
  financialData: FinancialDataV2Doc | null,
  hints?: { nombreUnites?: number | null }
): ManualFinancialEntryDraft {
  const base = financialData?.baseData;
  const calc = financialData?.calculatedResults;
  const dep = (base?.depenses ?? {}) as Record<string, unknown>;
  const fin = (base?.financement ?? {}) as Record<string, unknown>;

  const depenses: Record<string, string> = {};
  for (const field of EXPENSE_FIELDS) {
    const key = String(field.key);
    depenses[key] = formatDraftNum(dep[key]);
  }

  const financement = emptyManualFinancementDraft();
  financement.soldeHypothecaire = formatDraftNum(
    fin.soldeHypothecaire ?? fin.montantHypotheque ?? calc?.montantHypotheque
  );
  financement.tauxInteret = formatDraftNum(fin.tauxInteret);
  financement.penaliteRemboursement = formatDraftNum(
    fin.penaliteRemboursement ?? fin.penalite
  );
  financement.paiementMensuel = formatDraftNum(
    fin.paiementMensuel ?? calc?.paiementMensuel
  );
  financement.amortissement = formatDraftNum(fin.amortissement ?? calc?.amortissementBanque);
  financement.dscr = formatDraftNum(fin.dscr);
  financement.tgaPreteur = formatDraftNum(fin.tgaPreteur);

  return {
    revenusAnnuels: formatDraftNum(
      base?.revenusAnnuels ?? calc?.revenuBrutEffectif ?? calc?.revenusAnnuels
    ),
    nombreUnites: formatDraftNum(base?.nombreUnites ?? hints?.nombreUnites),
    depenses,
    financement,
  };
}

function buildFinancementFromDraft(draft: ManualFinancementDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const solde = parseNum(draft.soldeHypothecaire);
  if (solde > 0) {
    out.soldeHypothecaire = solde;
    out.montantHypotheque = solde;
  }
  const taux = parseNum(draft.tauxInteret);
  if (taux > 0) out.tauxInteret = taux;
  const penalite = parseNum(draft.penaliteRemboursement);
  if (penalite > 0) {
    out.penaliteRemboursement = penalite;
    out.penalite = penalite;
  }
  const mensuel = parseNum(draft.paiementMensuel);
  if (mensuel > 0) {
    out.paiementMensuel = mensuel;
    out.mensualite = mensuel;
  }
  const amort = parseNum(draft.amortissement);
  if (amort > 0) out.amortissement = amort;
  const dscr = parseNum(draft.dscr);
  if (dscr > 0) out.dscr = dscr;
  const tga = parseNum(draft.tgaPreteur);
  if (tga > 0) out.tgaPreteur = tga;
  return out;
}

/** Proposition IA → brouillon du panneau manuel (aucune écriture Firestore). */
export function manualFinancialEntryDraftFromExtraction(
  extracted: Record<string, unknown>,
  selectedRows?: ExtractedAmountRow[],
  hints?: { nombreUnites?: number | null }
): ManualFinancialEntryDraft | null {
  const expensePatchFromRows: Record<string, number> = {};
  if (selectedRows?.length) {
    for (const row of selectedRows) {
      const key = row.expenseKey ?? 'divers';
      expensePatchFromRows[key] = row.value;
    }
  }

  const mergeResult = mergeExtractedIntoFinancialDataV2({
    existing: null,
    extracted,
    expensePatchFromRows:
      Object.keys(expensePatchFromRows).length > 0 ? expensePatchFromRows : undefined,
    mergeRevenues: true,
    mergeExpenses: true,
  });

  if (mergeResult?.doc) {
    return manualFinancialEntryDraftFromData(mergeResult.doc, hints);
  }

  if (!selectedRows?.length) return null;
  const draft = manualFinancialEntryDraftFromData(null, hints);
  for (const row of selectedRows) {
    const key = row.expenseKey ?? 'divers';
    draft.depenses[key] = String(Math.round(row.value));
  }
  return draft;
}

export interface SaveManualFinancialEntryOptions {
  /** Validation humaine après pré-remplissage IA. */
  humanValidatedFromIa?: boolean;
  sourceDocumentId?: string;
}

export async function saveManualFinancialEntry(
  residenceId: string,
  existing: FinancialDataV2Doc | null,
  draft: ManualFinancialEntryDraft,
  prixDemande: number | null | undefined,
  options?: SaveManualFinancialEntryOptions
): Promise<void> {
  const revenus = parseNum(draft.revenusAnnuels);
  const unites = parseNum(draft.nombreUnites);

  const depensesPatch: Record<string, number> = {};
  for (const field of EXPENSE_FIELDS) {
    const key = String(field.key);
    const amount = parseNum(draft.depenses[key]);
    if (amount > 0) depensesPatch[key] = Math.round(amount);
  }

  const existingDep = (existing?.baseData?.depenses ?? {}) as Record<string, unknown>;
  const mergedDepenses = { ...existingDep, ...depensesPatch };

  const existingFin = (existing?.baseData?.financement ?? {}) as Record<string, unknown>;
  const mergedFinancement = {
    ...existingFin,
    ...buildFinancementFromDraft(draft.financement),
  };

  const baseData: FinancialBaseData = {
    ...(existing?.baseData ?? {}),
    ...(revenus > 0 ? { revenusAnnuels: revenus } : {}),
    ...(unites > 0 ? { nombreUnites: unites } : {}),
    depenses: mergedDepenses,
    financement: mergedFinancement,
  };

  let calculatedResults = recomputeFinancialCalculatedResults(
    baseData,
    existing?.calculatedResults ?? null
  );

  const prix = parseNum(prixDemande);
  if (calculatedResults) {
    calculatedResults = {
      ...calculatedResults,
      _source: options?.humanValidatedFromIa ? 'ai_extraction' : 'manual_entry',
      _confidence: options?.humanValidatedFromIa ? 'human_validated' : 'validation_required',
      ...(prix > 0 ? { prixDemande: prix } : {}),
    };
    const tauxCapitalisation = resolveCapitalizationRateFromRne(
      calculatedResults.revenuNetExploitation,
      prix
    );
    if (tauxCapitalisation != null) {
      calculatedResults.tauxCapitalisation = tauxCapitalisation;
    }
    const mensuel = parseNum(draft.financement.paiementMensuel);
    if (mensuel > 0) {
      calculatedResults.paiementMensuel = mensuel;
      calculatedResults.paiementAnnuel = Math.round(mensuel * 12);
    }
    const solde = parseNum(draft.financement.soldeHypothecaire);
    if (solde > 0) calculatedResults.montantHypotheque = solde;
    const amort = parseNum(draft.financement.amortissement);
    if (amort > 0) calculatedResults.amortissementBanque = amort;
  }

  const docRef = doc(db, 'residences', residenceId, 'financial', 'dataV2');
  await setDoc(
    docRef,
    stripUndefinedDeep({
      baseData,
      calculatedResults: calculatedResults ?? existing?.calculatedResults ?? null,
      lastUpdated: serverTimestamp(),
      ...(options?.humanValidatedFromIa
        ? {
            lastInjection: {
              source: 'human_validated_ia',
              documentId: options.sourceDocumentId ?? null,
              atMillis: Date.now(),
            },
          }
        : {}),
    }),
    { merge: true }
  );
}
