/**
 * Sauvegarde financial/dataV2 — ajustements CPA (colonne Normalisé).
 */

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  EXPENSE_KEYS,
  sumNormalizedOperatingExpenses,
  type FinancialDataV2Doc,
} from '@primexpert/core/financial';
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
  const revenuNetExploitation =
    rbe > 0 ? Math.round(rbe - depensesTotalesNormalisees) : null;

  const prixDemande = parseNum(
    (financialData.calculatedResults as Record<string, unknown> | undefined)?.prixDemande
  );
  const tauxCapitalisation =
    revenuNetExploitation != null &&
    revenuNetExploitation > 0 &&
    prixDemande > 0
      ? revenuNetExploitation / prixDemande
      : undefined;

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
