/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/documents/
 * Régénéré : functions/scripts/sync-core-documents.cjs (prebuild)
 */
/**
 * Normalisation post-Gemini — schéma omnivore Statistiques du marché.
 */

import type {
  ComparableTransactionRow,
  MarketReportRegionRow,
  OperationalBenchmarkRow,
  RpaTypePenetration,
} from './marketReportTypes';

function coerceNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceInt(value: unknown): number | undefined {
  const n = coerceNum(value);
  if (n == null) return undefined;
  const i = Math.round(n);
  return i >= 1990 && i <= 2100 ? i : undefined;
}

function slugId(parts: unknown[]): string {
  return parts
    .filter((p) => p != null && String(p).trim())
    .map((p) => String(p).trim().toLowerCase().replace(/\s+/g, '-'))
    .join('|')
    .slice(0, 120);
}

function normalizeUnite(raw: unknown): 'pi2' | 'porte' | 'unite' {
  const s = String(raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (/pi2|pi²|pied|sqft|square/.test(s)) return 'pi2';
  if (/porte|door|lit|bed/.test(s)) return 'porte';
  return 'unite';
}

function normalizePenetrationRows(raw: unknown): RpaTypePenetration[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: RpaTypePenetration[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const typeRpa = String(row.typeRpa ?? row.type ?? row.categorie ?? '').trim();
    if (!typeRpa) continue;
    out.push({
      typeRpa,
      tauxPenetrationPct: coerceNum(row.tauxPenetrationPct ?? row.tauxPenetration ?? row.penetration),
      population75Plus: coerceNum(row.population75Plus ?? row.population75) ?? undefined,
      unitesInstallees: coerceNum(row.unitesInstallees ?? row.unites) ?? undefined,
    });
  }
  return out.length ? out : undefined;
}

function normalizeCoutRemplacement(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const montant = coerceNum(row.montant ?? row.cout ?? row.value ?? row.prix);
  if (montant == null || montant <= 0) return null;
  return {
    unite: normalizeUnite(row.unite ?? row.unit),
    montant,
    devise: String(row.devise ?? row.currency ?? 'CAD'),
    notes: String(row.notes ?? '').trim() || undefined,
  };
}

function normalizeChantierRows(raw: unknown): MarketReportRegionRow['projetsEnChantier'] {
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<MarketReportRegionRow['projetsEnChantier']> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const nomProjet = String(row.nomProjet ?? row.projet ?? row.nom ?? '').trim();
    const ville = String(row.ville ?? row.city ?? '').trim();
    const regionAdministrative = String(row.regionAdministrative ?? row.region ?? '').trim();
    const nouvellesUnites = coerceNum(row.nouvellesUnites ?? row.unites ?? row.units);
    if (!nomProjet && !ville && nouvellesUnites == null) continue;
    out.push({
      nomProjet: nomProjet || undefined,
      ville: ville || undefined,
      regionAdministrative: regionAdministrative || undefined,
      nouvellesUnites,
      typeProjet: String(row.typeProjet ?? row.type ?? '').trim() || undefined,
      statut: String(row.statut ?? row.status ?? '').trim() || undefined,
      livraisonPrevue: String(row.livraisonPrevue ?? row.livraison ?? '').trim() || undefined,
    });
  }
  return out.length ? out : undefined;
}

function normalizeRegionRow(raw: unknown, index: number): MarketReportRegionRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const regionAdministrative = String(
    row.regionAdministrative ?? row.region ?? row.regionKey ?? ''
  ).trim();
  if (!regionAdministrative) return null;

  return {
    regionAdministrative,
    regionDisplayName:
      String(row.regionDisplayName ?? row.regionLabel ?? regionAdministrative).trim() || undefined,
    tauxPenetration: normalizePenetrationRows(row.tauxPenetration ?? row.penetrationParType),
    coutRemplacementNeuf: normalizeCoutRemplacement(
      row.coutRemplacementNeuf ?? row.coutRemplacement ?? row.replacementCost
    ),
    nouvellesUnitesEnChantier: coerceNum(
      row.nouvellesUnitesEnChantier ?? row.unitesEnChantier ?? row.pipelineUnites
    ),
    projetsEnChantier: normalizeChantierRows(row.projetsEnChantier ?? row.chantiers ?? row.projets),
  };
}

function normalizeTransactionRow(raw: unknown, index: number): ComparableTransactionRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const ville = String(row.ville ?? row.city ?? row.municipalite ?? '').trim();
  const adresse = String(row.adresse ?? row.address ?? row.rue ?? '').trim();
  if (!ville && !adresse) return null;

  const prixVente = coerceNum(row.prixVente ?? row.prix ?? row.salePrice ?? row.montant);
  const nbPortes = coerceNum(row.nbPortes ?? row.nbUnites ?? row.portes ?? row.units ?? row.unites);
  const prixParPorte = coerceNum(
    row.prixParPorte ?? row.prixParUnite ?? row.prixPorte ?? row.pricePerDoor ?? row.pricePerUnit
  );
  const tgaPct = coerceNum(row.tgaPct ?? row.tga ?? row.capRatePct ?? row.capRate);
  const superficiePi2 = coerceNum(row.superficiePi2 ?? row.pi2 ?? row.superficie);
  const prixParPi2 = coerceNum(row.prixParPi2 ?? row.prixPi2 ?? row.pricePerSqft);

  const rowId =
    String(row.rowId ?? row.id ?? '').trim() ||
    slugId([adresse, ville, row.dateTransaction ?? row.date, index]);

  return {
    rowId,
    adresse: adresse || undefined,
    ville: ville || adresse || '—',
    regionAdministrative: String(row.regionAdministrative ?? row.region ?? '').trim() || undefined,
    dateTransaction: String(row.dateTransaction ?? row.date ?? row.dateVente ?? '').trim() || undefined,
    prixVente,
    nbPortes: nbPortes != null ? Math.round(nbPortes) : null,
    nbUnites: nbPortes != null ? Math.round(nbPortes) : null,
    prixParPorte,
    prixParUnite: prixParPorte,
    tgaPct,
    superficiePi2,
    prixParPi2,
    vendeur: String(row.vendeur ?? row.seller ?? row.vendeurNom ?? '').trim() || undefined,
    acheteur: String(row.acheteur ?? row.buyer ?? row.acheteurNom ?? '').trim() || undefined,
    typeImmeuble: String(row.typeImmeuble ?? row.type ?? row.assetType ?? '').trim() || undefined,
    anneeConstruction:
      coerceNum(row.anneeConstruction ?? row.yearBuilt) != null
        ? Math.round(coerceNum(row.anneeConstruction ?? row.yearBuilt)!)
        : null,
  };
}

function normalizeOperationalRow(raw: unknown, index: number): OperationalBenchmarkRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const label = String(row.label ?? row.poste ?? row.ratio ?? row.name ?? '').trim();
  if (!label) return null;

  const rowId = String(row.rowId ?? row.id ?? '').trim() || slugId([label, row.regionAdministrative, index]);

  return {
    rowId,
    label,
    regionAdministrative: String(row.regionAdministrative ?? row.region ?? '').trim() || undefined,
    ratioPct: coerceNum(row.ratioPct ?? row.ratio ?? row.pct),
    montantParPorte: coerceNum(
      row.montantParPorte ?? row.montantParUnite ?? row.perDoor ?? row.perUnit
    ),
    montantParUnite: coerceNum(
      row.montantParUnite ?? row.montantParPorte ?? row.perDoor ?? row.perUnit
    ),
    montantAnnuel: coerceNum(row.montantAnnuel ?? row.montant ?? row.amount),
    categorie: String(row.categorie ?? row.category ?? '').trim() || undefined,
  };
}

function inferMarketDocumentType(raw: Record<string, unknown>, fileName: string): string {
  const fromModel = String(raw.documentType ?? '').trim();
  if (fromModel) return fromModel;
  const fn = fileName.toLowerCase();
  if (/altus/.test(fn)) return 'Guide Altus — coûts de remplacement et marché RPA';
  if (/mercier|cote/.test(fn)) return 'Rapport Côté Mercier — marché des résidences pour aînés (RPA)';
  if (/demo|demograph/.test(fn)) return 'Brief démographique — pénétration 75 ans et plus';
  if (/acm|compar/.test(fn)) return 'Analyse comparative de marché (ACM) — ventes récentes';
  if (/eval|25112|23527|st-jean|st_jean/.test(fn)) {
    return "Rapport d'évaluation — transactions et comparables";
  }
  return 'Registre de transactions immobilières — multilogement / RPA';
}

function isMarketVaultPayload(raw: Record<string, unknown>, fileName: string): boolean {
  if (raw.documentCategory === 'MARKET_REPORT') return true;
  if (raw.macroTrends || raw.comparableTransactions || raw.operationalBenchmarks) return true;
  if (Array.isArray(raw.regions) || Array.isArray(raw.comparables) || Array.isArray(raw.transactions)) {
    return true;
  }
  const dt = String(raw.documentType ?? '').toLowerCase();
  if (/altus|mercier|macro|demograph|pénétration|penetration|chantier|transaction|evaluat|compar|tga|multilog/.test(dt)) {
    return true;
  }
  const fn = fileName.toLowerCase();
  return /altus|mercier|cote.?mercier|demograph|macro|market|25112|23527|st-jean|eval|acm|transaction/.test(fn);
}

/** Normalise la réponse Gemini vers MasterMarketExtractionSchema. */
export function normalizeMasterMarketExtract(
  raw: Record<string, unknown>,
  fileName: string
): Record<string, unknown> | null {
  if (!isMarketVaultPayload(raw, fileName)) return null;

  const macroTrendsObj =
    raw.macroTrends && typeof raw.macroTrends === 'object' && !Array.isArray(raw.macroTrends)
      ? (raw.macroTrends as Record<string, unknown>)
      : null;

  const regionsRaw = macroTrendsObj?.regions
    ? macroTrendsObj.regions
    : Array.isArray(raw.regions)
      ? raw.regions
      : Array.isArray(raw.grillesRegionales)
        ? raw.grillesRegionales
        : [];

  const regions = (Array.isArray(regionsRaw) ? regionsRaw : [])
    .map((r, i) => normalizeRegionRow(r, i))
    .filter((r): r is NonNullable<ReturnType<typeof normalizeRegionRow>> => r != null);

  const txRaw = [
    ...(Array.isArray(raw.comparableTransactions) ? raw.comparableTransactions : []),
    ...(Array.isArray(raw.transactions) ? raw.transactions : []),
    ...(Array.isArray(raw.comparables) ? raw.comparables : []),
    ...(Array.isArray(raw.ventes) ? raw.ventes : []),
  ];

  const comparableTransactions = txRaw
    .map((r, i) => normalizeTransactionRow(r, i))
    .filter((r): r is ComparableTransactionRow => r != null);

  const benchRaw = [
    ...(Array.isArray(raw.operationalBenchmarks) ? raw.operationalBenchmarks : []),
    ...(Array.isArray(raw.ratios) ? raw.ratios : []),
    ...(Array.isArray(raw.benchmarks) ? raw.benchmarks : []),
    ...(Array.isArray(raw.amounts) ? raw.amounts : []),
  ];

  const operationalBenchmarks = benchRaw
    .map((r, i) => normalizeOperationalRow(r, i))
    .filter((r): r is OperationalBenchmarkRow => r != null);

  if (!regions.length && !comparableTransactions.length && !operationalBenchmarks.length) {
    return null;
  }

  const out: Record<string, unknown> = {
    documentCategory: 'MARKET_REPORT',
    documentType: inferMarketDocumentType(raw, fileName),
  };

  if (regions.length) out.macroTrends = { regions };

  if (comparableTransactions.length) out.comparableTransactions = comparableTransactions;
  if (operationalBenchmarks.length) out.operationalBenchmarks = operationalBenchmarks;

  const sourcePublisher = String(raw.sourcePublisher ?? raw.editeur ?? '').trim();
  if (sourcePublisher) out.sourcePublisher = sourcePublisher;

  const anneePublication = coerceInt(raw.anneePublication ?? raw.annee);
  if (anneePublication) out.anneePublication = anneePublication;

  const anneeDonnees = coerceInt(raw.anneeDonnees ?? raw.anneeReference);
  if (anneeDonnees) out.anneeDonnees = anneeDonnees;

  return out;
}

/** @deprecated Alias */
export function normalizeMarketReportExtract(
  raw: Record<string, unknown>,
  fileName: string
): Record<string, unknown> | null {
  return normalizeMasterMarketExtract(raw, fileName);
}
