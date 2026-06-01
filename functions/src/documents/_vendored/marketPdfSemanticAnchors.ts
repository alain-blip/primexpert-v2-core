/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/market/
 * Régénéré : functions/scripts/sync-core-market.cjs (prebuild)
 */
/**
 * Ancrages sémantiques québécois — découpage local des rapports marché (V2.8).
 * SSOT : pages pertinentes avant envoi Vertex / Gemini.
 */

/** Ancrages commerciaux (RPA, TGA) et résidentiels (SCHL, liquidité). */
export const MARKET_REPORT_SEMANTIC_ANCHORS = [
  'TGA',
  'Taux de capitalisation global',
  '75 ans et plus',
  'MSSS',
  'SCHL',
  'Indice de liquidité',
  'Months of Inventory',
  'MOI',
  'SP/LP',
] as const;

const NORMALIZED_ANCHORS = MARKET_REPORT_SEMANTIC_ANCHORS.map((a) =>
  a
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
);

/** Vrai si le texte de page contient au moins un ancrage sémantique marché. */
export function pageTextMatchesMarketSemanticAnchors(pageText: string): boolean {
  const normalized = pageText.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
  if (!normalized.trim()) return false;
  return NORMALIZED_ANCHORS.some((anchor) => normalized.includes(anchor));
}

/** Indices 0-based des pages contenant un ancrage sémantique. */
export function findSemanticPageIndices(pageTexts: readonly string[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < pageTexts.length; i++) {
    if (pageTextMatchesMarketSemanticAnchors(pageTexts[i] ?? '')) indices.push(i);
  }
  return indices;
}

export interface SelectMarketParsePagesOptions {
  /** Pages de tête si aucun ancrage détecté (défaut : 3). */
  fallbackLeadingPages?: number;
}

/**
 * Pages à soumettre au moteur IA — ancrages sémantiques prioritaires ;
 * repli sur les premières pages si le PDF est scanné ou sans texte extractible.
 */
export function selectMarketParsePageIndices(
  pageTexts: readonly string[],
  options?: SelectMarketParsePagesOptions
): number[] {
  const semantic = findSemanticPageIndices(pageTexts);
  if (semantic.length > 0) return semantic;
  const fallback = options?.fallbackLeadingPages ?? 3;
  const count = Math.min(fallback, pageTexts.length);
  return Array.from({ length: count }, (_, i) => i);
}
