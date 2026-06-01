/**
 * Vérification financière EEE — prudence bancaire (réserve remplacement / CFE).
 * SSOT : financial/dataV2 + champs résidence. Aucune écriture Firestore.
 */

import { DSCR_RULES } from './financialRules';
import { sumDeclaredOperatingExpenses, type FinancialBaseData, type FinancialCalc } from './normalizeFinancialData';
import { CAPEX_RESERVE_PER_UNIT_ANNUAL } from './normalizationSuggestions';

export interface FinancialAuditEeeAlert {
  severity: 'warning' | 'error';
  code: string;
  messageFr: string;
  messageEn: string;
}

export interface FinancialAuditEeeResult {
  units: number;
  noiReported: number;
  noiNormalized: number;
  theoreticalCapex: number;
  explicitReserve: number;
  capexShortfall: number;
  capRateReported: number | null;
  capRateNormalized: number | null;
  dscrReported: number | null;
  dscrNormalized: number | null;
  alerts: FinancialAuditEeeAlert[];
  reserveRuleLabelFr: string;
  reserveRuleLabelEn: string;
}

function safeNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n =
    typeof v === 'string' ? parseFloat(String(v).replace(/[^\d.-]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeOccupancyRate(v: unknown): number | null {
  const n = safeNum(v);
  if (n == null || n <= 0) return null;
  if (n > 1 && n <= 100) return n / 100;
  if (n <= 1) return n;
  return null;
}

function getUnits(
  residence: Record<string, unknown> = {},
  calc: Record<string, unknown> = {},
  baseData: FinancialBaseData | null = null
): number {
  return (
    safeNum(residence.nombreUnitesTotal) ??
    safeNum(residence.nombreUnites) ??
    safeNum(residence.unitesRPA) ??
    safeNum(residence.capacite) ??
    safeNum(calc.nombreUnites) ??
    safeNum(baseData?.nombreUnites) ??
    0
  );
}

function sumReserveFromAutresDepenses(depenses: FinancialBaseData['depenses'] | undefined): number {
  const rows = depenses?.autresDepenses;
  if (!Array.isArray(rows)) return 0;
  const re = /réserve|reserve|cfe|remplacement|capital|toiture|ascenseur\s*majeur/i;
  let s = 0;
  for (const row of rows) {
    const nom = String(row?.nom ?? '').trim();
    const m = safeNum(row?.montant);
    if (m != null && m > 0 && re.test(nom)) s += m;
  }
  return s;
}

export interface ComputeFinancialAuditEeeParams {
  residence?: Record<string, unknown>;
  calc?: FinancialCalc | Record<string, unknown> | null;
  baseData?: FinancialBaseData | null;
  prixDemande?: number;
  paiementAnnuelDette?: number;
}

export function computeFinancialAuditEee(
  params: ComputeFinancialAuditEeeParams
): FinancialAuditEeeResult {
  const residence = params.residence ?? {};
  const calc = (params.calc ?? {}) as Record<string, unknown>;
  const baseData = params.baseData ?? null;
  const prixDemande = params.prixDemande ?? 0;
  const paiementAnnuelDette = params.paiementAnnuelDette ?? 0;

  const units = getUnits(residence, calc, baseData);
  const revenuBrut =
    safeNum(calc.revenuBrutEffectif) ?? safeNum(calc.revenusAnnuels) ?? 0;
  const depDeclareesSum = sumDeclaredOperatingExpenses(baseData?.depenses);
  const noiReported =
    depDeclareesSum != null && revenuBrut > 0
      ? revenuBrut - depDeclareesSum
      : safeNum(calc.revenuNetExploitation) ?? 0;

  const loyerMoyenMensuel =
    safeNum(residence.loyerMoyen) ?? safeNum(residence.avgRent) ?? null;

  const theoreticalCapex = units > 0 ? CAPEX_RESERVE_PER_UNIT_ANNUAL * units : 0;
  const explicitReserve = sumReserveFromAutresDepenses(baseData?.depenses ?? undefined);
  const capexShortfall = Math.max(0, theoreticalCapex - explicitReserve);
  const noiNormalized = noiReported - capexShortfall;

  const capRateReported =
    prixDemande > 0 && noiReported > 0 ? noiReported / prixDemande : null;
  const capRateNormalized =
    prixDemande > 0 && noiNormalized > 0 ? noiNormalized / prixDemande : null;

  const dscrReported =
    paiementAnnuelDette > 0 && noiReported > 0 ? noiReported / paiementAnnuelDette : null;
  const dscrNormalized =
    paiementAnnuelDette > 0 && noiNormalized > 0 ? noiNormalized / paiementAnnuelDette : null;

  const alerts: FinancialAuditEeeAlert[] = [];

  if (units > 0 && loyerMoyenMensuel != null && loyerMoyenMensuel > 0 && revenuBrut > 0) {
    const potentielPlein = units * loyerMoyenMensuel * 12;
    const ecart = Math.abs(revenuBrut - potentielPlein) / revenuBrut;
    if (ecart > 0.15) {
      alerts.push({
        severity: 'warning',
        code: 'REVENU_VS_UNITES_LOYER',
        messageFr: `Écart > 15 % entre le revenu brut effectif (RBE) saisi et l'ordre de grandeur « unités × loyer moyen × 12 ». Vérifier loyers, services inclus ou revenus non locatifs.`,
        messageEn:
          'Gap > 15% between effective gross income (EGI) and units × average rent × 12. Verify rents, included services or non-rental income.',
      });
    }
  }

  const tauxOccDeclare = normalizeOccupancyRate(residence.tauxOccupation);
  if (
    tauxOccDeclare != null &&
    units > 0 &&
    loyerMoyenMensuel != null &&
    loyerMoyenMensuel > 0 &&
    revenuBrut > 0
  ) {
    const potentiel = units * loyerMoyenMensuel * 12;
    const occImplicite = Math.min(1.25, revenuBrut / potentiel);
    if (Math.abs(occImplicite - tauxOccDeclare) > 0.05) {
      alerts.push({
        severity: 'warning',
        code: 'OCCUPATION_VS_REVENUS',
        messageFr: `Écart > 5 pts : occupation déclarée ~${(tauxOccDeclare * 100).toFixed(0)} % vs implicite ~${(occImplicite * 100).toFixed(0)} %.`,
        messageEn: `Gap > 5 pts: declared occupancy ~${(tauxOccDeclare * 100).toFixed(0)}% vs implicit ~${(occImplicite * 100).toFixed(0)}%.`,
      });
    }
  }

  if (dscrNormalized != null && dscrNormalized < DSCR_RULES.MINIMUM_BANK) {
    alerts.push({
      severity: 'error',
      code: 'DSCR_NORMALISE_SOUS_SEUIL',
      messageFr: `Ratio de couverture du service de la dette (DSCR) sur revenu net normalisé (${dscrNormalized.toFixed(2)}×) sous le plancher bancaire (${DSCR_RULES.MINIMUM_BANK}×).`,
      messageEn: `Debt service coverage ratio (DSCR) on normalized NOI (${dscrNormalized.toFixed(2)}×) below bank floor (${DSCR_RULES.MINIMUM_BANK}×).`,
    });
  }

  return {
    units,
    noiReported,
    noiNormalized,
    theoreticalCapex,
    explicitReserve,
    capexShortfall,
    capRateReported,
    capRateNormalized,
    dscrReported,
    dscrNormalized,
    alerts,
    reserveRuleLabelFr: `${CAPEX_RESERVE_PER_UNIT_ANNUAL.toLocaleString('fr-CA')} $ / unité / an (réserve remplacement théorique)`,
    reserveRuleLabelEn: `${CAPEX_RESERVE_PER_UNIT_ANNUAL.toLocaleString('en-CA')} $ / unit / year (theoretical replacement reserve)`,
  };
}
