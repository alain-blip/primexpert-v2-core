/**
 * Suggestions de normalisation (HITL) — règles recyclées de normalizationKnowledge.js (legacy).
 * Le courtier valide toujours le montant final dans la colonne « Normalisé ».
 */

import { MARKET_REF_PCT_OF_RBE } from './expenseFields';

export const MANAGEMENT_FEE_NORMALIZATION_PCT = 0.0425;
export const CAPEX_RESERVE_PER_UNIT_ANNUAL = 500;

export interface NormalizationSuggestion {
  ruleId: string;
  expenseKey?: string;
  labelFr: string;
  labelEn: string;
  suggestedNormalized: number | null;
  suggestedAdjustment: number | null;
  explanationFr: string;
  explanationEn: string;
}

export interface NormalizationSuggestionInput {
  rbe: number;
  nombreUnites?: number | null;
  declaredByKey: Record<string, number>;
  normalizedByKey?: Record<string, number>;
}

/** Frais de gestion — propriétaire-opérateur : normaliser à 4,25 % du revenu brut effectif (RBE). */
export function suggestManagementFeeNormalization(
  input: NormalizationSuggestionInput
): NormalizationSuggestion | null {
  const { rbe } = input;
  if (!rbe || rbe <= 0) return null;
  const declared = input.declaredByKey.fraisGestion ?? 0;
  const ratio = declared / rbe;
  if (ratio >= 0.02) return null;

  const suggestedNormalized = Math.round(rbe * MANAGEMENT_FEE_NORMALIZATION_PCT);
  return {
    ruleId: 'RULE_002',
    expenseKey: 'fraisGestion',
    labelFr: 'Frais de gestion',
    labelEn: 'Management fees',
    suggestedNormalized,
    suggestedAdjustment: suggestedNormalized - declared,
    explanationFr:
      'Propriétaire-opérateur détecté — suggestion à 4,25 % du revenu brut effectif (RBE), standard résidence pour aînés (RPA) gérée professionnellement.',
    explanationEn:
      'Owner-operator detected — suggest 4.25% of effective gross income (EGI), standard for professionally managed senior living.',
  };
}

/** Réserve d'entretien — 500 $ / unité / an si entretien déclaré sous le marché. */
export function suggestMaintenanceReserveNormalization(
  input: NormalizationSuggestionInput
): NormalizationSuggestion | null {
  const units = input.nombreUnites ?? 0;
  if (units <= 0 || !input.rbe || input.rbe <= 0) return null;

  const declared = input.declaredByKey.entretienReparation ?? 0;
  const theoreticalReserve = CAPEX_RESERVE_PER_UNIT_ANNUAL * units;
  const marketPct = MARKET_REF_PCT_OF_RBE.entretienReparation ?? 5.5;
  const marketAmount = (marketPct / 100) * input.rbe;

  if (declared >= marketAmount * 0.85) return null;

  const suggestedNormalized = Math.max(declared, Math.round(theoreticalReserve));
  if (suggestedNormalized <= declared) return null;

  return {
    ruleId: 'CAPEX_RESERVE',
    expenseKey: 'entretienReparation',
    labelFr: 'Entretien / réparation',
    labelEn: 'Maintenance / repairs',
    suggestedNormalized,
    suggestedAdjustment: suggestedNormalized - declared,
    explanationFr: `Réserve de remplacement prudente — ${CAPEX_RESERVE_PER_UNIT_ANNUAL.toLocaleString('fr-CA')} $ / unité / an (${units} unités).`,
    explanationEn: `Prudent replacement reserve — ${CAPEX_RESERVE_PER_UNIT_ANNUAL.toLocaleString('en-CA')} $ / unit / year (${units} units).`,
  };
}

export function buildNormalizationSuggestions(
  input: NormalizationSuggestionInput
): NormalizationSuggestion[] {
  const out: NormalizationSuggestion[] = [];
  const mgmt = suggestManagementFeeNormalization(input);
  if (mgmt) out.push(mgmt);
  const maint = suggestMaintenanceReserveNormalization(input);
  if (maint) out.push(maint);
  return out;
}
