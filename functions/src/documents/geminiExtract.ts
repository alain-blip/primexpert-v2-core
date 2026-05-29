/**
 * Extraction Gemini via Vertex AI (ADC / compte de service Cloud Functions).
 * Pipeline universel — le type réel est déduit du contenu et du nom de fichier, pas du dossier.
 */

import {
  getVertexClient,
  getVertexGeminiModel,
  getVertexLocation,
  getVertexProject,
} from '../services/vertexClient';
import {
  inferStorageCategory,
  resolveExtractionKind,
  resolveTaxonomyEntry,
  taxonomyLabelsForGeminiPrompt,
} from './documentTaxonomy';
import { enrichExtractedDataWithOperatingBenchmarks } from './_vendored/extractionSchemas';
import {
  marketReportLabelsForPrompt,
} from './_vendored/marketReportTypes';
import { normalizeMasterMarketExtract } from './_vendored/marketReportNormalize';
import { STATISTICIAN_PERSONA } from '../services/vertexClient';

export type DetectedDocumentType =
  | 'certificat_localisation'
  | 'etats_financiers'
  | 'rapport_evaluation'
  | 'market_report';

const CL_BLOCK = `
### Si documentType = "certificat_localisation"
{
  "metadataCL": {
    "dateCertificat": "2025-05-28",
    "arpenteur": "Nom complet",
    "lotCadastral": "3179566",
    "superficieTerrainMetres": 4141.0
  },
  "irregularites": ["Empiétement du mur de béton", "Garage dans la bande riveraine de 6 m", "Zone inondable 0-20 ans"],
  "suggestionClauseDV": "Clause section D — Déclaration du vendeur (OACIQ, français québécois)"
}
- irregularites : dérogations juridiques, une chaîne par constat (tri conceptuel par gravité dans le texte)
- suggestionClauseDV : clause prudente protégeant vendeur et courtier; 3 à 6 phrases
- NE PAS inclure amounts, comparables, sujet`;

const PNL_BLOCK = `
### Si documentType = "etats_financiers"
{
  "amounts": [{ "label": "Revenus totaux", "value": 0, "currency": "CAD" }],
  "annee": 2024,
  "nbPortes": 42
}
- UNIQUEMENT état des résultats d'EXPLOITATION (revenus et dépenses détaillés)
- revenuTotal / RBE : ligne « Produits totaux » (prioritaire), « Revenus totaux » ou « Chiffre d'affaires total » — JAMAIS le bénéfice net ni un sous-total de revenus
- Extraire chaque poste de dépense d'exploitation en ligne distincte dans amounts
- EXCLURE des dépenses d'exploitation (mais les lister quand même dans amounts) :
  amortissement, frais financiers / intérêts / frais bancaires, impôts sur le revenu, bénéfice net
- total OPEX : ligne « Total des charges » / « Total des dépenses d'exploitation » — somme de tous les postes admissibles
- NE PAS utiliser le bénéfice net comme revenu net d'exploitation (RNE)
- RNE = Produits totaux (RBE) MOINS total des dépenses d'exploitation admissibles UNIQUEMENT
- IGNORER bilan, actif, passif, notes comptables
- nbPortes : nombre de portes, lits ou unités locatives si indiqué
- Libellés clairs en français québécois`;

const EVAL_BLOCK = `
### Si documentType = "rapport_evaluation"
{
  "sujet": { "anneeConstruction": 1985, "superficieTotale": 12500, "tgaRetenu": 14.22, "valeurAvaluee": 4500000 },
  "comparables": [{ "city": "Ville", "region": "Capitale-Nationale", "units": 19, "salePrice": 0, "capRatePct": 14.22, "netIncomePerUnit": 0 }],
  "annee": 2024,
  "amounts": []
}
- Rapport d'évaluation agréé (JLR, évaluateur agréé, ACM)
- comparables : immeubles comparables (ville sans adresse civique)
- amounts : seulement si l'état des résultats d'exploitation est inclus dans le rapport`;

const MARKET_REPORT_BLOCK = `
### Si documentCategory = "MARKET_REPORT" (schéma omnivore — TOUT type de PDF marché)
${STATISTICIAN_PERSONA}

Retourne documentCategory = "MARKET_REPORT" et remplis TOUTES les sections pertinentes (sections absentes = omettre la clé) :

{
  "documentCategory": "MARKET_REPORT",
  "documentType": "<libellé — voir liste ci-dessous>",
  "sourcePublisher": "Altus | Côté Mercier | JLR | évaluateur agréé | autre",
  "anneePublication": 2025,
  "anneeDonnees": 2024,
  "macroTrends": {
    "regions": [{
      "regionAdministrative": "Montréal",
      "regionDisplayName": "Montréal",
      "tauxPenetration": [{ "typeRpa": "RPA privé", "tauxPenetrationPct": 4.2 }],
      "coutRemplacementNeuf": { "unite": "pi2", "montant": 385, "devise": "CAD" },
      "nouvellesUnitesEnChantier": 820,
      "projetsEnChantier": [{ "nomProjet": "Projet X", "ville": "Laval", "nouvellesUnites": 120 }]
    }]
  },
  "comparableTransactions": [{
    "rowId": "tx-1",
    "adresse": "123 Rue Exemple",
    "ville": "Montréal",
    "regionAdministrative": "Montréal",
    "dateTransaction": "2024-06-15",
    "prixVente": 4500000,
    "nbPortes": 42,
    "prixParPorte": 107142,
    "tgaPct": 6.25,
    "superficiePi2": 35000,
    "prixParPi2": 128.57,
    "vendeur": "Nom vendeur si présent",
    "acheteur": "Nom acheteur si présent",
    "typeImmeuble": "RPA"
  }],
  "operationalBenchmarks": [{
    "rowId": "bench-1",
    "label": "Ratio des dépenses d'exploitation (RDE)",
    "regionAdministrative": "Montréal",
    "ratioPct": 62.5,
    "montantParPorte": 18500,
    "montantAnnuel": null,
    "categorie": "exploitation"
  }],
  "tgaPct": 6.25,
  "population75_plus": 125000,
  "monthsOfInventory": 8.5,
  "sellingPriceListingPriceRatio": 0.98
}

Variables canoniques OBLIGATOIRES (racine JSON — omettre si absentes du PDF) :
- tgaPct : taux de capitalisation (TGA) en pourcentage — volet commercial / RPA
- population75_plus : population 75 ans et plus (bassin démographique MSSS) — volet commercial / RPA
- monthsOfInventory : indice de liquidité / mois d'inventaire (MOI) — volet résidentiel SCHL
- sellingPriceListingPriceRatio : ratio prix de vente / prix affiché (SP/LP) — volet résidentiel SCHL

Règles :
- macroTrends : grilles régionales, pénétration 75+, coûts Altus, chantier RPA
- comparableTransactions : CHAQUE vente / comparable du document (rapports évaluateur, ACM, registres)
- operationalBenchmarks : ratios financiers, dépenses moyennes/porte, RDE, RBE, RNE
- rowId unique par ligne (tx-1, tx-2… ou bench-1…)
- Libellés documentType (copie exacte si applicable) :
${marketReportLabelsForPrompt()}`;

const UNIVERSAL_EXTRACT_PROMPT = `Tu es un expert en diligence immobilière (Québec, OACIQ). Analyse le CONTENU du document PDF et le nom du fichier. Le dossier de dépôt peut être erroné — ignore-le.

## ÉTAPE 1 — documentType (libellé EXACT, un seul)
Choisis EXACTEMENT UN libellé dans cette liste (copie caractère pour caractère, français québécois) :
${taxonomyLabelsForGeminiPrompt()}

## ÉTAPE 2 — Extraction structurée (selon le type)
Si le document est un certificat de localisation → applique aussi :
${CL_BLOCK}
Si états financiers / bilans / résultats d'exploitation → applique aussi :
${PNL_BLOCK}
Si rapport d'évaluation agréé → applique aussi :
${EVAL_BLOCK}
Si rapport macro / marché global (Altus, Côté Mercier, démographie, chantier RPA) → applique aussi :
${MARKET_REPORT_BLOCK}
Sinon : retourne uniquement { "documentType": "<libellé exact>" }.

Réponse JSON unique :
{
  "documentType": "<libellé exact de l'étape 1>",
  ...champs d'extraction pertinents uniquement
}`;

const CL_EXPIRY_YEARS = 10;
const CL_REFERENCE_YEAR = 2026;

function parseJsonFromModelText(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const payload = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch (parseErr) {
    console.error('[geminiExtract] JSON parse failed — raw model text', {
      preview: trimmed.slice(0, 2000),
      length: trimmed.length,
      parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
    throw parseErr;
  }
}

function coerceAmountRow(item: unknown): { label: string; value: number; currency: string } | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const label = String(row.label ?? '').trim();
  if (!label) return null;

  const rawValue = row.value ?? row.amount;
  const value =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? parseFloat(rawValue.replace(/[^\d.-]/g, ''))
        : NaN;
  if (Number.isNaN(value)) return null;

  return {
    label,
    value,
    currency: String(row.currency ?? 'CAD'),
  };
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function sortAlpha(strings: string[]): string[] {
  return [...strings].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

function coerceComparableRow(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const city = String(row.city ?? row.label ?? row.name ?? '').trim();
  if (!city) return null;

  const out: Record<string, unknown> = { city };
  const region = String(row.region ?? row.regionKey ?? '').trim();
  if (region) out.region = region;
  const units = coerceNumber(row.units);
  if (units != null) out.units = units;
  const salePrice = coerceNumber(row.salePrice);
  if (salePrice != null) out.salePrice = salePrice;
  const capRatePct = coerceNumber(row.capRatePct);
  if (capRatePct != null) out.capRatePct = capRatePct;
  const netIncomePerUnit = coerceNumber(row.netIncomePerUnit);
  if (netIncomePerUnit != null) out.netIncomePerUnit = netIncomePerUnit;
  return out;
}

function coerceSubject(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const anneeConstruction = coerceNumber(row.anneeConstruction);
  if (anneeConstruction != null && anneeConstruction > 1800 && anneeConstruction < 2100) {
    out.anneeConstruction = Math.round(anneeConstruction);
  }
  const superficieTotale = coerceNumber(row.superficieTotale);
  if (superficieTotale != null && superficieTotale > 0) out.superficieTotale = superficieTotale;
  const tgaRetenu = coerceNumber(row.tgaRetenu);
  if (tgaRetenu != null && tgaRetenu > 0) out.tgaRetenu = tgaRetenu;
  const valeurAvaluee = coerceNumber(row.valeurAvaluee);
  if (valeurAvaluee != null && valeurAvaluee > 0) out.valeurAvaluee = valeurAvaluee;
  return Object.keys(out).length ? out : undefined;
}

function coerceMetadataCL(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const dateCertificat = String(row.dateCertificat ?? row.date ?? '').trim();
  if (dateCertificat) out.dateCertificat = dateCertificat;
  const arpenteur = String(row.arpenteur ?? '').trim();
  if (arpenteur) out.arpenteur = arpenteur;
  const lotCadastral = String(row.lotCadastral ?? row.lot ?? '').trim();
  if (lotCadastral) out.lotCadastral = lotCadastral;
  const superficieTerrainMetres = coerceNumber(row.superficieTerrainMetres ?? row.superficie);
  if (superficieTerrainMetres != null && superficieTerrainMetres > 0) {
    out.superficieTerrainMetres = superficieTerrainMetres;
  }
  return Object.keys(out).length ? out : undefined;
}

function computeIsExpiredCL(dateCertificat?: string): boolean {
  if (!dateCertificat) return false;
  const year = parseInt(dateCertificat.slice(0, 4), 10);
  if (!Number.isFinite(year) || year < 1900) return false;
  return CL_REFERENCE_YEAR - year > CL_EXPIRY_YEARS;
}

function coerceIrregularites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const items = raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'description' in item) {
        return String((item as Record<string, unknown>).description ?? '').trim();
      }
      return '';
    })
    .filter((s) => s.length > 0);
  return sortAlpha(items);
}

const ALERTE_CL_LABELS: Record<string, string> = {
  nonConformiteRive: 'Non-conformité de marge ou bande riveraine',
  nonConformiteZonage: 'Non-conformité de zonage',
  zoneInondable: 'Zone inondable (cartographie)',
  apparenceEmpietement: 'Empiétement apparent',
  apparenceServitude: 'Servitude apparente',
};

function coerceIrregularitesFromAlertes(alertes: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [key, label] of Object.entries(ALERTE_CL_LABELS)) {
    if (alertes[key] === true) out.push(label);
  }
  return sortAlpha(out);
}

function parseDocumentType(raw: unknown): DetectedDocumentType | undefined {
  const t = String(raw ?? '').toLowerCase().trim();
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).documentCategory === 'MARKET_REPORT') {
    return 'market_report';
  }
  if (t === 'market_report' || t.includes('altus') || t.includes('mercier') || t.includes('macro')) {
    return 'market_report';
  }
  if (t === 'certificat_localisation' || t === 'cl' || t.includes('localisation')) {
    return 'certificat_localisation';
  }
  if (t === 'rapport_evaluation' || t.includes('evaluation') || t.includes('évaluation')) {
    return 'rapport_evaluation';
  }
  if (t === 'etats_financiers' || t.includes('financier')) {
    return 'etats_financiers';
  }
  return undefined;
}

function inferDocumentTypeFromPayload(raw: Record<string, unknown>): DetectedDocumentType {
  const explicit = parseDocumentType(raw.documentType);
  if (explicit) return explicit;

  if (coerceMetadataCL(raw.metadataCL)) return 'certificat_localisation';
  const comparables = Array.isArray(raw.comparables) ? raw.comparables : [];
  const sujet = coerceSubject(raw.sujet);
  if (comparables.length > 0 || sujet) return 'rapport_evaluation';

  return 'etats_financiers';
}

function defaultClLabel(): string {
  return (
    resolveTaxonomyEntry('certificat_localisation')?.labelFr ??
    'Certificat de localisation récent (< 10 ans)'
  );
}

function normalizeCL(raw: Record<string, unknown>, documentTypeLabel: string): Record<string, unknown> {
  const metadataCL = coerceMetadataCL(raw.metadataCL);
  if (!metadataCL) return { amounts: [], documentType: documentTypeLabel };

  let irregularites = coerceIrregularites(raw.irregularites);
  if (!irregularites.length && raw.alertesConformite && typeof raw.alertesConformite === 'object') {
    irregularites = coerceIrregularitesFromAlertes(raw.alertesConformite as Record<string, unknown>);
  }
  const suggestionClauseDV = String(raw.suggestionClauseDV ?? '').trim();
  const extracted: Record<string, unknown> = {
    documentType: documentTypeLabel,
    amounts: [],
    metadataCL,
    irregularites,
    isExpiredCL: computeIsExpiredCL(String(metadataCL.dateCertificat ?? '')),
  };
  if (suggestionClauseDV) extracted.suggestionClauseDV = suggestionClauseDV;
  return extracted;
}

function normalizeFinancial(raw: Record<string, unknown>, documentTypeLabel: string): Record<string, unknown> {
  const merged: { label: string; value: number; currency: string }[] = [];
  const sources = [
    ...(Array.isArray(raw.amounts) ? raw.amounts : []),
    ...(Array.isArray(raw.revenus) ? raw.revenus : []),
    ...(Array.isArray(raw.depenses) ? raw.depenses : []),
    ...(Array.isArray(raw.taxes) ? raw.taxes : []),
  ];

  for (const item of sources) {
    const row = coerceAmountRow(item);
    if (row) merged.push(row);
  }
  merged.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));

  const extracted: Record<string, unknown> = {
    documentType: documentTypeLabel,
    amounts: merged,
  };
  if (typeof raw.annee === 'number' && raw.annee > 1990 && raw.annee < 2100) {
    extracted.annee = raw.annee;
  }
  const nbPortes = coerceNumber(raw.nbPortes ?? raw.nombreUnites);
  if (nbPortes != null && nbPortes > 0) extracted.nbPortes = Math.round(nbPortes);

  return enrichExtractedDataWithOperatingBenchmarks(extracted);
}

function normalizeEvaluation(raw: Record<string, unknown>, documentTypeLabel: string): Record<string, unknown> {
  const merged: { label: string; value: number; currency: string }[] = [];
  for (const item of Array.isArray(raw.amounts) ? raw.amounts : []) {
    const row = coerceAmountRow(item);
    if (row) merged.push(row);
  }
  merged.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));

  const extracted: Record<string, unknown> = {
    documentType: documentTypeLabel,
    amounts: merged,
  };
  if (typeof raw.annee === 'number' && raw.annee > 1990 && raw.annee < 2100) {
    extracted.annee = raw.annee;
  }

  const comparables: Record<string, unknown>[] = [];
  if (Array.isArray(raw.comparables)) {
    for (const item of raw.comparables) {
      const row = coerceComparableRow(item);
      if (row) comparables.push(row);
    }
  }
  comparables.sort((a, b) =>
    String(a.city).localeCompare(String(b.city), 'fr', { sensitivity: 'base' })
  );
  if (comparables.length) extracted.comparables = comparables;

  const sujet = coerceSubject(raw.sujet);
  if (sujet) extracted.sujet = sujet;

  if (merged.length > 0) {
    return enrichExtractedDataWithOperatingBenchmarks(extracted);
  }
  return extracted;
}

function normalizeMarketReport(raw: Record<string, unknown>, fileName: string): Record<string, unknown> {
  const normalized = normalizeMasterMarketExtract(raw, fileName);
  if (normalized) return normalized;
  return {
    documentCategory: 'MARKET_REPORT',
    documentType: String(raw.documentType ?? 'Registre de transactions immobilières — multilogement / RPA'),
    macroTrends: { regions: [] },
    comparableTransactions: [],
    operationalBenchmarks: [],
  };
}

/** SSOT — normalise selon documentType détecté par Gemini (nomenclature Alain). */
export function normalizeExtractedData(
  raw: Record<string, unknown>,
  fileName = ''
): Record<string, unknown> {
  if (raw.documentCategory === 'MARKET_REPORT' || normalizeMasterMarketExtract(raw, fileName)) {
    return normalizeMarketReport(raw, fileName);
  }

  const labelFromModel = String(raw.documentType ?? '').trim();
  const entry = resolveTaxonomyEntry(labelFromModel);
  const documentTypeLabel = entry?.labelFr ?? (labelFromModel || 'Document non classé');

  const kind =
    resolveExtractionKind(documentTypeLabel) ??
    resolveExtractionKind(labelFromModel) ??
    inferDocumentTypeFromPayload(raw);

  let extracted: Record<string, unknown>;
  switch (kind) {
    case 'certificat_localisation':
      extracted = normalizeCL(raw, entry?.labelFr ?? defaultClLabel());
      break;
    case 'rapport_evaluation':
      extracted = normalizeEvaluation(raw, documentTypeLabel);
      break;
    case 'etats_financiers':
      extracted = normalizeFinancial(raw, documentTypeLabel);
      break;
    default:
      if (normalizeMasterMarketExtract(raw, fileName)) {
        extracted = normalizeMarketReport(raw, fileName);
      } else if (
        (Array.isArray(raw.amounts) && raw.amounts.length > 0) ||
        (Array.isArray(raw.revenus) && raw.revenus.length > 0) ||
        (Array.isArray(raw.depenses) && raw.depenses.length > 0) ||
        (Array.isArray(raw.taxes) && raw.taxes.length > 0)
      ) {
        extracted = normalizeFinancial(raw, documentTypeLabel);
      } else {
        extracted = { documentType: documentTypeLabel, amounts: [] };
      }
  }

  extracted.documentType = documentTypeLabel;
  extracted.inferredStorageCategory = inferStorageCategory(documentTypeLabel);
  return extracted;
}

function formatVertexError(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err);
  if (/SERVICE_DISABLED|has not been used|aiplatform\.googleapis\.com/i.test(base)) {
    return `VERTEX_API_DISABLED: activez aiplatform.googleapis.com sur primexpert-app-v2 — ${base.slice(0, 200)}`;
  }
  if (/PERMISSION_DENIED|403 Forbidden/i.test(base)) {
    return `VERTEX_PERMISSION_DENIED: accordez roles/aiplatform.user au compte de service Cloud Functions — ${base.slice(0, 200)}`;
  }
  if (/NOT_FOUND|was not found|invalid model/i.test(base)) {
    return `VERTEX_MODEL_NOT_FOUND: vérifiez VERTEX_GEMINI_MODEL (ex. gemini-2.5-flash) — ${base.slice(0, 200)}`;
  }
  if (/UNAUTHENTICATED|invalid authentication|credentials/i.test(base)) {
    return `VERTEX_AUTH: sur Cloud Functions l'ADC utilise le compte de service runtime (pas de clé JSON) — ${base.slice(0, 200)}`;
  }
  return base.slice(0, 500);
}

export interface ExtractFinancialDocumentOptions {
  /** Ignoré — le type est déduit du contenu (pipeline universel). */
  category?: string;
  /** Force le pipeline macro marché (Vault global). */
  documentCategory?: 'MARKET_REPORT';
}

export async function extractFinancialDocumentWithGemini(
  mimeType: string,
  base64Data: string,
  fileName: string,
  options?: ExtractFinancialDocumentOptions
): Promise<Record<string, unknown>> {
  const project = getVertexProject();
  const location = getVertexLocation();
  const modelId = getVertexGeminiModel();

  console.info('[geminiExtract] universal pipeline start', {
    project,
    location,
    model: modelId,
    mimeType,
    fileName,
    payloadBytes: base64Data.length,
  });

  if (location !== 'us-central1') {
    throw new Error(
      `VERTEX_REGION_MISMATCH: le parseur exige us-central1 (reçu: ${location})`
    );
  }

  try {
    const vertex = await getVertexClient();
    const model = vertex.getGenerativeModel({
      model: modelId,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const marketHint =
      options?.documentCategory === 'MARKET_REPORT'
        ? `\n\n${STATISTICIAN_PERSONA}\n\nIMPORTANT : Ce PDF provient du Vault « Statistiques du marché ». Retourne documentCategory = "MARKET_REPORT" et remplis macroTrends, comparableTransactions et operationalBenchmarks selon le contenu réel.\n`
        : '';

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: UNIVERSAL_EXTRACT_PROMPT + marketHint },
            { text: `Nom du fichier : ${fileName}` },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
    });

    const text =
      result.response?.candidates?.[0]?.content?.parts
        ?.map((p) => ('text' in p ? p.text : ''))
        .join('') ?? '';

    if (!text) throw new Error('VERTEX_EMPTY_RESPONSE: réponse vide du modèle Gemini.');
    const normalized = normalizeExtractedData(parseJsonFromModelText(text), fileName);
    console.info('[geminiExtract] universal pipeline done', {
      documentType: normalized.documentType,
      textLength: text.length,
    });
    return normalized;
  } catch (err) {
    const formatted = formatVertexError(err);
    console.error('[geminiExtract] error', { project, location, model: modelId, formatted });
    throw new Error(formatted);
  }
}
