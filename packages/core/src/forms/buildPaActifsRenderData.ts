/**
 * Assemble le payload PA Actifs depuis le dictionnaire canonique Core (SSOT).
 * Couplage : financial/dataV2, offre tronc V3.2, promesseAchatEngine, ACM territorial.
 */

import { normalizeFinancialData } from '../financial/normalizeFinancialData';
import { resolveCanonicalFinancialMetrics } from '../financial/resolveCanonicalRne';
import {
  applyCapRateAdjustmentPct,
  capitalizeNoiAtCapRatePct,
} from '../financial/capitalization';
import { bootstrapResidenceAcm, type ResidenceAcmIdentity } from '../valuation/residenceAcmBootstrap';
import { parsePromesseAchatFromDoc } from '../transaction/promesseAchatEngine';
import { computeSoldeAFinancer, parseOffreTroncFromDoc } from '../transaction/offreTronc';
import type {
  BuildPaActifsRenderDataInput,
  PaActifsBusinessClauses,
  PaActifsRenderData,
  PaActifsResidenceDesignation,
} from './paActifsTypes';

const DEFAULT_CLAUSES: PaActifsBusinessClauses = {
  maintienOperationsVersion: '7.2',
  transitionHeuresMax: 150,
  transitionJoursMax: 60,
  nonConcurrenceRayonKm: 50,
  nonConcurrenceAnnees: 3,
};

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function mergeDoc(
  residence: Record<string, unknown>,
  residenceDoc?: Record<string, unknown> | null
): Record<string, unknown> {
  return { ...residence, ...(residenceDoc ?? {}) };
}

function resolveDesignation(merged: Record<string, unknown>): PaActifsResidenceDesignation {
  const terrain = merged.superficieTerrain ?? merged.superficieTotale;
  const batiment = merged.superficieBatiment;
  let superficiePi2 = '';
  if (terrain != null && batiment != null) {
    superficiePi2 = `Terrain : ${terrain} pi² — Bâtiment : ${batiment} pi²`;
  } else if (merged.superficieTotale != null) {
    superficiePi2 = `${merged.superficieTotale} pi²`;
  }

  return {
    commercialName:
      str(merged.nomCommercial) ||
      str(merged.residenceName) ||
      str(merged.name) ||
      str(merged.nom) ||
      '—',
    civicAddress: str(merged.address) || str(merged.adresse) || '—',
    cadastralDesignation:
      str(merged.designationCadastrale) ||
      str(merged.cadastre) ||
      (merged.lotCadastre ? `Cadastre du Québec — ${merged.lotCadastre}` : undefined),
    superficiePi2: superficiePi2 || undefined,
    city: str(merged.city) || str(merged.ville) || str(merged.municipalite) || undefined,
    regionAdministrative:
      str(merged.regionAdministrative) || str(merged.region) || undefined,
  };
}

/**
 * Construit les données de rendu PA Actifs sans manipulation ZIP/OpenXML.
 * `territorial` provient typiquement de `useTerritorialCompetition` (V3.2).
 */
export function buildPaActifsRenderData(input: BuildPaActifsRenderDataInput): PaActifsRenderData {
  const locale = input.locale ?? 'fr';
  const merged = mergeDoc(input.residence, input.residenceDoc);
  const promesseDoc = input.promesseDoc ?? merged;
  const promesse = parsePromesseAchatFromDoc(promesseDoc);
  const offre = parseOffreTroncFromDoc(promesseDoc);

  const normalized = normalizeFinancialData(
    input.financialData as Parameters<typeof normalizeFinancialData>[0],
    merged as Parameters<typeof normalizeFinancialData>[1]
  );
  const metrics = resolveCanonicalFinancialMetrics(
    normalized.calc,
    normalized.baseData
  );

  const acmBootstrap = bootstrapResidenceAcm(
    merged as ResidenceAcmIdentity,
    merged,
    input.financialData as Parameters<typeof bootstrapResidenceAcm>[2]
  );

  const medianTga = input.territorial?.medianTgaPct ?? acmBootstrap?.suggestedCapRatePct ?? null;
  const tgaAdj = input.qualitativeTgaAdjustmentPct ?? 0;
  const tgaApplique =
    medianTga != null && medianTga > 0
      ? Number((applyCapRateAdjustmentPct(medianTga, tgaAdj) ?? medianTga).toFixed(2))
      : null;

  const rne = metrics.rne ?? acmBootstrap?.revenuNetExploitation ?? null;
  const rbe = metrics.rbe ?? acmBootstrap?.revenuBrutEffectif ?? null;

  const prixTotal =
    offre.prixOffert ??
    promesse.prixOffert ??
    num(merged.prixDemande) ??
    num(merged.askingPrice) ??
    num(merged.price);

  const miseDeFonds = offre.acompteMontant ?? null;
  const balancePrixVente = offre.balanceVenteMontant ?? null;
  const soldeEmprunt = computeSoldeAFinancer({
    prixOffert: prixTotal ?? undefined,
    acompteMontant: miseDeFonds ?? undefined,
    balanceVenteMontant: balancePrixVente ?? undefined,
  });

  const valeurIndicative =
    rne != null && rne > 0 && tgaApplique != null && tgaApplique > 0
      ? Math.round(capitalizeNoiAtCapRatePct(rne, tgaApplique) ?? 0)
      : acmBootstrap?.valuationAngles.marketValue ?? null;

  const buyerName =
    input.buyer?.fullName ||
    offre.acheteurNom ||
    promesse.buyer?.fullName ||
    '';

  const vendorLegal =
    input.vendor?.legalName ||
    str(merged.raisonSociale) ||
    str(merged.vendeurNom) ||
    str(merged.companyName) ||
    '—';

  return {
    locale,
    generatedAtIso: new Date().toISOString().slice(0, 10),
    referenceId: input.referenceId ?? (str(merged.id) || undefined),
    buyer: {
      fullName: buyerName || '—',
      address: input.buyer?.address,
      authorizedSignatory: input.buyer?.authorizedSignatory,
    },
    vendor: {
      legalName: vendorLegal,
      address:
        input.vendor?.address ||
        str(merged.vendeurAdresse) ||
        str(merged.address) ||
        '—',
      presidentName: input.vendor?.presidentName || str(merged.signataireNom),
      secretaryName: input.vendor?.secretaryName,
    },
    broker: input.broker,
    residence: resolveDesignation(merged),
    financial: {
      prixTotal,
      miseDeFonds,
      balancePrixVente,
      soldeNouvelEmprunt: soldeEmprunt ?? null,
      revenuNetExploitation: rne,
      revenuBrutEffectif: rbe,
      tgaMedianTerritorialPct: medianTga,
      tgaAjustementQualitatifPct: tgaAdj,
      tgaAppliquePct: tgaApplique,
      valeurMarchandeIndicative: valeurIndicative,
      territorialSampleCount: input.territorial?.sampleCount ?? acmBootstrap?.capRateSampleCount ?? 0,
    },
    clauses: { ...DEFAULT_CLAUSES, ...input.clauses },
    promesse,
    offre,
    territorial: input.territorial ?? null,
    signatures: input.signatures ?? {},
  };
}
