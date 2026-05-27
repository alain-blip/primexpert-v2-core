/**
 * Raphaël — Matchmaker IA (lecture seule CRM × finances résidence).
 * Scoring de pertinence acheteur QUALIFIED vs prix demandé et taux de capitalisation (TGA).
 */

import type { CalculatedResultsDisplayMirror } from '../financial/normalizeFinancialData';
import {
  extractResidenceAddressAndCities,
  normalizeResidenceSearchText,
} from '../residence/residenceSearch';
import { buildContactDisplayName } from './contactUiHelpers';
import type { OrganizationContact } from './contactTypes';

export interface RaphaelResidenceFinancialSnapshot {
  rne: number | null;
  tgaPercent: number | null;
  askingPrice: number | null;
  ville: string;
  locationTokens: string[];
}

export interface RaphaelMatchCandidate {
  contactId: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  relevanceScore: number;
  budgetMax: number | null;
  buyerTgaMinimumPercent: number | null;
  regionMatch: boolean;
  budgetCoveragePct: number | null;
  tgaDeltaPoints: number | null;
}

const SCORE_WEIGHT_BUDGET = 0.5;
const SCORE_WEIGHT_TGA = 0.35;
const SCORE_WEIGHT_REGION = 0.15;

function finitePositive(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** Normalise un TGA en pourcentage affichable (ex. 0,08 → 8). */
export function toTgaPercent(value: number | null | undefined): number | null {
  const n = finitePositive(value);
  if (n == null) return null;
  return n <= 1 ? n * 100 : n;
}

export function buildRaphaelResidenceSnapshot(params: {
  financialMirror: CalculatedResultsDisplayMirror;
  askingPrice: number;
  residence: Record<string, unknown>;
}): RaphaelResidenceFinancialSnapshot {
  const loc = extractResidenceAddressAndCities(params.residence);
  const tokens = new Set<string>();
  const addToken = (raw?: string) => {
    if (!raw?.trim()) return;
    tokens.add(normalizeResidenceSearchText(raw));
  };
  addToken(loc.ville);
  addToken(loc.city);
  addToken(loc.municipalite);
  const regionRaw = params.residence.region ?? params.residence.regionSociosanitaire;
  if (typeof regionRaw === 'string') addToken(regionRaw);

  return {
    rne: params.financialMirror.rne,
    tgaPercent: toTgaPercent(params.financialMirror.tgaRatio),
    askingPrice: finitePositive(params.askingPrice) ?? null,
    ville: loc.ville ?? loc.city ?? '',
    locationTokens: [...tokens],
  };
}

/** Acheteurs Tier 1 — qualification explicite QUALIFIED (NDA + preuve de fonds). */
export function filterQualifiedBuyerContacts(
  contacts: readonly OrganizationContact[]
): OrganizationContact[] {
  return contacts.filter(
    (c) =>
      c.relationRoles?.includes('buyer') === true &&
      c.buyerQualificationStatus === 'QUALIFIED'
  );
}

function resolveBuyerCompanyName(contact: OrganizationContact): string | null {
  const entreprise = contact.entreprise?.trim();
  if (entreprise) return entreprise;
  const mandate = contact.buyerCriteria?.corporateMandate?.companyName?.trim();
  if (mandate) return mandate;
  return null;
}

function resolveBuyerBudgetMax(contact: OrganizationContact): number | null {
  return (
    finitePositive(contact.buyerCriteria?.budgetMax) ??
    finitePositive(contact.buyerCriteria?.downpaymentAmount)
  );
}

function resolveBuyerTgaMinimumPercent(contact: OrganizationContact): number | null {
  return toTgaPercent(contact.buyerCriteria?.tgaMinimum);
}

function scoreRegionMatch(
  residence: RaphaelResidenceFinancialSnapshot,
  contact: OrganizationContact
): boolean {
  const regions = contact.buyerCriteria?.regions;
  if (!regions?.length) return true;

  const buyerTokens = regions
    .map((r) => normalizeResidenceSearchText(r))
    .filter(Boolean);
  if (!buyerTokens.length) return true;

  const residenceTokens = [...residence.locationTokens];
  const contactCity = contact.adresse?.ville;
  if (contactCity?.trim()) {
    residenceTokens.push(normalizeResidenceSearchText(contactCity));
  }

  if (!residenceTokens.length) return true;

  return buyerTokens.some((b) =>
    residenceTokens.some((t) => t.includes(b) || b.includes(t))
  );
}

function scoreBudgetComponent(
  askingPrice: number | null,
  budgetMax: number | null
): { score: number; coveragePct: number | null } {
  if (!askingPrice || !budgetMax) return { score: 50, coveragePct: null };
  const ratio = budgetMax / askingPrice;
  const coveragePct = Math.round(ratio * 100);
  if (ratio >= 1) return { score: 100, coveragePct };
  if (ratio >= 0.85) return { score: 85, coveragePct };
  if (ratio >= 0.7) return { score: 65, coveragePct };
  if (ratio >= 0.5) return { score: 40, coveragePct };
  return { score: Math.max(10, Math.round(ratio * 100)), coveragePct };
}

function scoreTgaComponent(
  residenceTga: number | null,
  buyerTgaMin: number | null
): { score: number; deltaPoints: number | null } {
  if (!residenceTga || !buyerTgaMin) return { score: 55, deltaPoints: null };
  const delta = residenceTga - buyerTgaMin;
  if (delta >= 0) {
    const bonus = Math.min(15, delta * 2);
    return { score: Math.min(100, 90 + bonus), deltaPoints: Math.round(delta * 100) / 100 };
  }
  const penalty = Math.min(80, Math.abs(delta) * 12);
  return { score: Math.max(15, 90 - penalty), deltaPoints: Math.round(delta * 100) / 100 };
}

/**
 * Score un acheteur QUALIFIED vs la résidence (0–100).
 * Retourne null si le contact n'est pas un acheteur qualifié.
 */
export function scoreRaphaelBuyerMatch(
  residence: RaphaelResidenceFinancialSnapshot,
  contact: OrganizationContact
): RaphaelMatchCandidate | null {
  if (!contact.relationRoles?.includes('buyer')) return null;
  if (contact.buyerQualificationStatus !== 'QUALIFIED') return null;

  const budgetMax = resolveBuyerBudgetMax(contact);
  const buyerTgaMin = resolveBuyerTgaMinimumPercent(contact);
  const regionMatch = scoreRegionMatch(residence, contact);

  const budgetPart = scoreBudgetComponent(residence.askingPrice, budgetMax);
  const tgaPart = scoreTgaComponent(residence.tgaPercent, buyerTgaMin);
  const regionScore = regionMatch ? 100 : 20;

  const relevanceScore = Math.round(
    budgetPart.score * SCORE_WEIGHT_BUDGET +
      tgaPart.score * SCORE_WEIGHT_TGA +
      regionScore * SCORE_WEIGHT_REGION
  );

  return {
    contactId: contact.id,
    displayName: buildContactDisplayName(contact),
    companyName: resolveBuyerCompanyName(contact),
    email: contact.email?.trim() || null,
    relevanceScore: Math.max(0, Math.min(100, relevanceScore)),
    budgetMax,
    buyerTgaMinimumPercent: buyerTgaMin,
    regionMatch,
    budgetCoveragePct: budgetPart.coveragePct,
    tgaDeltaPoints: tgaPart.deltaPoints,
  };
}

/** Classe les acheteurs par pertinence décroissante. */
export function rankRaphaelMatches(
  residence: RaphaelResidenceFinancialSnapshot,
  contacts: readonly OrganizationContact[],
  limit = 12
): RaphaelMatchCandidate[] {
  const rows: RaphaelMatchCandidate[] = [];
  for (const contact of filterQualifiedBuyerContacts(contacts)) {
    const scored = scoreRaphaelBuyerMatch(residence, contact);
    if (scored) rows.push(scored);
  }
  rows.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return rows.slice(0, limit);
}
