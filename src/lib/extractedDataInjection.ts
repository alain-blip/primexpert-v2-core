/**
 * Mapping extraction IA → grille financial/dataV2 + segmentation Big Data.
 * Logique pure (SSOT locale documents ; pas de calcul CFO ici).
 */

import { findRegion } from '@primexpert/core/financial';
import type { ExpenseKey } from '@primexpert/core/financial';
import { EXPENSE_KEYS } from '@primexpert/core/financial';
import type { AssetNiche } from '../types/residence';
import type {
  MarketDataProvenance,
  MarketSiloType,
} from '../types/marketAnalytics';
import type {
  PropertyDocumentCategory,
  PropertyDocumentExtractedData,
} from '../types/propertyDocument';

function compareLocaleAlpha(a: string, b: string): number {
  return a.localeCompare(b, 'fr', { sensitivity: 'base' });
}

export const MARKET_SILO_OPTIONS: ReadonlyArray<{
  id: MarketSiloType;
  labelFr: string;
  labelEn: string;
}> = [
  { id: 'rpa_ri_chsld', labelFr: 'RPA / RI / CHSLD', labelEn: 'Senior living / LTC' },
  { id: 'plex_multi', labelFr: 'Plex multi-logements', labelEn: 'Multi-plex' },
  { id: 'cpe', labelFr: 'CPE (garde)', labelEn: 'Childcare (CPE)' },
  { id: 'condo_unifamilial', labelFr: 'Condo / unifamilial', labelEn: 'Condo / single-family' },
  { id: 'fonds_de_commerce', labelFr: 'Fonds de commerce', labelEn: 'Business sale' },
] as const;

export interface ExtractedAmountRow {
  id: string;
  label: string;
  value: number;
  currency: string;
  expenseKey: ExpenseKey | null;
}

export interface ExtractedComparableRow {
  id: string;
  city: string;
  region?: string;
  units?: number;
  salePrice?: number;
  capRatePct?: number;
  netIncomePerUnit?: number;
  displayLabel: string;
}

function coerceExtractNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

/** Heuristique libellé → clé dépense Copilote / dataV2. */
export function mapLabelToExpenseKey(label: string): ExpenseKey | null {
  const n = normalizeLabel(label);
  if (!n) return null;

  if (/taxe(s)?\s*(municip|scol)|municipal|school tax/.test(n)) {
    return 'taxesMunicipalesScolaire';
  }
  if (/taxe(s)?\s*et\s*permis|permis/.test(n)) return 'taxesPermis';
  if (/assurance/.test(n)) return 'assurances';
  if (/energie|electric|gaz|chauffage|mazout/.test(n)) return 'energie';
  if (/telecom|cabl|telephon/.test(n)) return 'telecommunications';
  if (/entretien|reparation|maintenance/.test(n)) return 'entretienReparation';
  if (/gestion|management/.test(n)) return 'fraisGestion';
  if (/honoraire|professionnel|comptab/.test(n)) return 'honorairesProfessionnels';
  if (/publicite|marketing/.test(n)) return 'publicite';
  if (/salaire|main d oeuvre|main-d'oeuvre|payroll/.test(n)) return 'salairesAvantages';
  if (/nourriture|food/.test(n)) return 'nourritures';
  if (/divers|misc/.test(n)) return 'divers';

  return null;
}

export function assetNicheToDefaultSilo(niche?: AssetNiche): MarketSiloType {
  switch (niche) {
    case 'PLEX':
      return 'plex_multi';
    case 'CPE':
      return 'cpe';
    case 'RPA':
    default:
      return 'rpa_ri_chsld';
  }
}

/** Silo Big Data déduit de la fiche active (`assetNiche` + type Radar). */
export function resolveSiloFromResidence(
  assetNiche?: AssetNiche,
  propertyType?: string
): MarketSiloType {
  const pt = propertyType?.toLowerCase();
  if (pt === 'commercial') return 'fonds_de_commerce';
  if (pt === 'condo') return 'condo_unifamilial';
  return assetNicheToDefaultSilo(assetNiche);
}

/** Lignes affichées sous « Données extraites » — SSOT `extractedData.amounts` uniquement. */
export function listExtractedAmounts(data: PropertyDocumentExtractedData): ExtractedAmountRow[] {
  const rows: ExtractedAmountRow[] = [];
  let i = 0;
  for (const a of data.amounts ?? []) {
    const num =
      typeof a.value === 'number'
        ? a.value
        : typeof a.value === 'string'
          ? parseFloat(String(a.value).replace(/[^\d.-]/g, ''))
          : NaN;
    if (!a.label?.trim() || Number.isNaN(num)) continue;
    const expenseKey = mapLabelToExpenseKey(a.label);
    rows.push({
      id: `amt-${i++}`,
      label: a.label.trim(),
      value: num,
      currency: a.currency ?? 'CAD',
      expenseKey:
        expenseKey && (EXPENSE_KEYS as readonly string[]).includes(expenseKey) ? expenseKey : null,
    });
  }
  rows.sort((a, b) => compareLocaleAlpha(a.label, b.label));
  return rows;
}

/** Dossier Firestore cible après injection (reclassement automatique). */
export function inferCategoryFromExtractedData(
  data: PropertyDocumentExtractedData
): PropertyDocumentCategory {
  const t = data.documentType;
  if (t === 'certificat_localisation' || hasExtractedCertificateLocalisation(data)) {
    return 'legal';
  }
  if (t === 'rapport_evaluation' || t === 'etats_financiers') {
    return 'financier';
  }
  if ((data.comparables?.length ?? 0) > 0 || hasExtractedEvaluationSubject(data)) {
    return 'financier';
  }
  if ((data.amounts?.length ?? 0) > 0) {
    return 'financier';
  }
  return 'technique';
}

export function isExtractionCL(data: PropertyDocumentExtractedData): boolean {
  return (
    data.documentType === 'certificat_localisation' || hasExtractedCertificateLocalisation(data)
  );
}

export function isExtractionFinancial(data: PropertyDocumentExtractedData): boolean {
  if (isExtractionCL(data)) return false;
  return (
    data.documentType === 'etats_financiers' ||
    data.documentType === 'rapport_evaluation' ||
    (data.amounts?.length ?? 0) > 0 ||
    (data.comparables?.length ?? 0) > 0 ||
    hasExtractedEvaluationSubject(data)
  );
}

export function inferProvenanceFromFileName(fileName: string): MarketDataProvenance {
  const n = normalizeLabel(fileName);
  if (/evaluation|evaluat|rapport d evaluation|appraisal|jlr/.test(n)) {
    return 'rapport_evaluation';
  }
  return 'etats_financiers';
}

export function resolveRegionAdministrative(city?: string, regionHint?: string): {
  code: string;
  displayName: string;
  regionAdministrative: string;
} {
  const row = findRegion(regionHint || city || '');
  if (row) {
    return {
      code: row.code,
      displayName: row.name,
      regionAdministrative: `${row.code.padStart(2, '0')}-${row.name}`,
    };
  }
  return {
    code: '00',
    displayName: 'Non classée',
    regionAdministrative: '00-Non classée',
  };
}

export function flattenExtractedAmounts(
  data: PropertyDocumentExtractedData
): ExtractedAmountRow[] {
  const rows: ExtractedAmountRow[] = [];
  let i = 0;

  const push = (label: string, value: unknown, currency = 'CAD') => {
    const num =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? parseFloat(value.replace(/[^\d.-]/g, ''))
          : NaN;
    if (!label || Number.isNaN(num)) return;
    const expenseKey = mapLabelToExpenseKey(label);
    rows.push({
      id: `amt-${i++}`,
      label: label.trim(),
      value: num,
      currency,
      expenseKey:
        expenseKey && (EXPENSE_KEYS as readonly string[]).includes(expenseKey) ? expenseKey : null,
    });
  };

  for (const a of data.amounts ?? []) {
    push(a.label, a.value, a.currency ?? 'CAD');
  }
  for (const t of data.taxes ?? []) {
    const label = t.label || `Taxes ${t.year ?? ''}`.trim();
    push(label, t.amount ?? 0);
  }
  for (const r of data.revenus ?? []) {
    push(r.label, r.value);
  }
  for (const d of data.depenses ?? []) {
    push(d.label, d.value);
  }

  return rows;
}

export function inferAnneeDonnees(
  data: PropertyDocumentExtractedData,
  fileName: string
): number {
  if (typeof data.annee === 'number' && data.annee > 1990 && data.annee < 2100) {
    return data.annee;
  }
  for (const d of data.dates ?? []) {
    const y = parseInt(d.isoDate?.slice(0, 4) ?? '', 10);
    if (y > 1990 && y < 2100) return y;
  }
  const m = fileName.match(/20\d{2}/);
  if (m) return parseInt(m[0], 10);
  return new Date().getFullYear();
}

export function formatExtractedCurrency(value: number, locale: 'fr' | 'en'): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Comparables issus du rapport d'évaluation (SSOT `extractedData.comparables`). */
export function listExtractedComparables(
  data: PropertyDocumentExtractedData,
  locale: 'fr' | 'en' = 'fr'
): ExtractedComparableRow[] {
  const rows: ExtractedComparableRow[] = [];
  let i = 0;
  for (const c of data.comparables ?? []) {
    const city = String(c.city ?? c.label ?? '').trim();
    if (!city) continue;
    const units = coerceExtractNumber(c.units);
    const capRatePct = coerceExtractNumber(c.capRatePct);
    rows.push({
      id: `cmp-${i++}`,
      city,
      region: c.region ?? c.regionKey,
      units,
      salePrice: coerceExtractNumber(c.salePrice),
      capRatePct,
      netIncomePerUnit: coerceExtractNumber(c.netIncomePerUnit),
      displayLabel: formatComparableDisplayLabel(city, units, capRatePct, locale),
    });
  }
  rows.sort((a, b) => compareLocaleAlpha(a.displayLabel, b.displayLabel));
  return rows;
}

export function formatComparableDisplayLabel(
  city: string,
  units: number | undefined,
  capRatePct: number | undefined,
  locale: 'fr' | 'en'
): string {
  const parts = [city];
  if (units != null && units > 0) {
    parts.push(
      locale === 'fr' ? `${units} unité${units > 1 ? 's' : ''}` : `${units} unit${units > 1 ? 's' : ''}`
    );
  }
  if (capRatePct != null && capRatePct > 0) {
    const pct = capRatePct > 1 ? capRatePct : capRatePct * 100;
    parts.push(locale === 'fr' ? `TGA ${pct.toFixed(2)} %` : `Cap rate ${pct.toFixed(2)}%`);
  }
  return parts.join(' - ');
}

export function hasExtractedEvaluationSubject(data: PropertyDocumentExtractedData): boolean {
  const s = data.sujet;
  if (!s) return false;
  return (
    s.anneeConstruction != null ||
    s.superficieTotale != null ||
    s.tgaRetenu != null ||
    s.valeurAvaluee != null
  );
}

/** Patch résidence racine — onglet Identité (champs canoniques + clés rapport). */
export function buildResidenceEvaluationSubjectPatch(
  data: PropertyDocumentExtractedData
): Record<string, unknown> | null {
  const s = data.sujet;
  if (!s) return null;

  const patch: Record<string, unknown> = {};
  if (s.anneeConstruction != null) patch.anneeConstruction = s.anneeConstruction;
  if (s.superficieTotale != null) {
    patch.superficieTotale = s.superficieTotale;
    patch.superficieBatiment = s.superficieTotale;
  }
  if (s.tgaRetenu != null) {
    patch.tgaRetenu = s.tgaRetenu;
    patch.tauxCapitalisation = s.tgaRetenu > 1 ? s.tgaRetenu / 100 : s.tgaRetenu;
  }
  if (s.valeurAvaluee != null) {
    patch.valeurAvaluee = s.valeurAvaluee;
    patch.valeurEstimee = s.valeurAvaluee;
  }
  return Object.keys(patch).length ? patch : null;
}

const CL_REFERENCE_YEAR = 2026;
const CL_EXPIRY_YEARS = 10;

/** Règle OACIQ : certificat de plus de 10 ans (réf. 2026). */
export function isCertificateExpiredByDate(dateCertificat?: string): boolean {
  if (!dateCertificat?.trim()) return false;
  const year = parseInt(dateCertificat.slice(0, 4), 10);
  if (!Number.isFinite(year) || year < 1900) return false;
  return CL_REFERENCE_YEAR - year > CL_EXPIRY_YEARS;
}

/** Certificat de localisation extrait (SSOT `extractedData.metadataCL`). */
export function hasExtractedCertificateLocalisation(data: PropertyDocumentExtractedData): boolean {
  const m = data.metadataCL;
  if (!m) return false;
  return Boolean(
    m.dateCertificat?.trim() ||
      m.arpenteur?.trim() ||
      m.lotCadastral?.trim() ||
      (m.superficieTerrainMetres != null && m.superficieTerrainMetres > 0)
  );
}

export function formatCertificateDate(isoDate: string, locale: 'fr' | 'en'): string {
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Patch cadastre résidence — lot et superficie terrain. */
export function buildResidenceCadastrePatch(
  data: PropertyDocumentExtractedData
): Record<string, unknown> | null {
  const m = data.metadataCL;
  if (!m) return null;

  const cadastre: Record<string, unknown> = {};
  if (m.lotCadastral?.trim()) cadastre.lotsCadastraux = m.lotCadastral.trim();
  if (m.superficieTerrainMetres != null && m.superficieTerrainMetres > 0) {
    cadastre.superficieTerrain = m.superficieTerrainMetres;
  }
  if (!Object.keys(cadastre).length) return null;

  const patch: Record<string, unknown> = { cadastre };
  if (cadastre.lotsCadastraux) patch.lotsCadastraux = cadastre.lotsCadastraux;
  if (cadastre.superficieTerrain) patch.superficieTerrain = cadastre.superficieTerrain;
  return patch;
}

/** Tri alphabétique des noms de fichiers (liste documentaire). */
export function sortDocumentsByFileName<T extends { fileName: string }>(docs: T[]): T[] {
  return [...docs].sort((a, b) => compareLocaleAlpha(a.fileName, b.fileName));
}
