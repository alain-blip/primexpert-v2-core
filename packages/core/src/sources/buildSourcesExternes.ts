/**
 * Construction des sources externes à partir des champs existants
 *
 * Mission 2 — Sources externes
 *
 * Cette fonction lit les champs existants d'une résidence et construit
 * une structure normalisée `sourcesExternes` sans modifier les données métier.
 *
 * INTERDICTIONS:
 * - Pas de fetch HTTP
 * - Pas de parsing PDF
 * - Pas de sync MSSS / REQ
 * - Pas d'écriture dans les champs métier
 */

import type { SourcesExternes, SourceRegistreRPA, SourceREQ, SourceSiteWeb } from './types';

/**
 * Interface minimale pour les champs de résidence utilisés
 * (compatible avec le type Residence complet)
 */
export interface ResidenceSourceFields {
  siteInternetRegistre?: string;
  numeroRegistre?: string;
  numeroRegistreMSSS?: string;
  neq?: string;
  siteWeb?: string;
  websiteUrl?: string;
  siteInternetResidence?: string;
}

// ============================================================================
// PATTERNS DE DÉTECTION
// ============================================================================

/**
 * Patterns pour détecter les URLs du registre MSSS
 * Formats connus:
 * - https://santemonteregie.qc.ca/rpa/12345
 * - https://www.msss.gouv.qc.ca/...
 * - https://portail-sante.quebec/...
 */
const MSSS_URL_PATTERNS = [
  /santemonteregie\.qc\.ca\/rpa\/(\d+)/i,
  /msss\.gouv\.qc\.ca/i,
  /portail-sante\.quebec/i,
  /sante\.gouv\.qc\.ca/i,
];

/**
 * Pattern pour valider un numéro de registre MSSS
 * Généralement un nombre de 4-6 chiffres
 */
const MSSS_NUMERO_PATTERN = /^\d{4,6}$/;

/**
 * Pattern pour valider un NEQ
 * Format: 10 chiffres commençant généralement par 117 ou 118
 */
const NEQ_PATTERN = /^(117|118|119|1\d{2})\d{7}$/;

/**
 * URL de base pour construire le lien REQ
 */
const REQ_BASE_URL = 'https://www.registreentreprises.gouv.qc.ca/RQAnonymeGR/GR/GR03/GR03A2_19A_PIU_RechEnt_PC/PageRechSimwordsNC.aspx?T1.Jeaceession=';

// ============================================================================
// FONCTIONS DE DÉTECTION
// ============================================================================

/**
 * Vérifie si une URL est une URL MSSS reconnue
 */
export function isMSSSUrl(url: string | undefined): boolean {
  if (!url) return false;
  return MSSS_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Extrait le numéro de registre d'une URL MSSS si possible
 */
export function extractNumeroFromMSSSUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  // Pattern santemonteregie.qc.ca/rpa/XXXXX
  const match = url.match(/santemonteregie\.qc\.ca\/rpa\/(\d+)/i);
  if (match) {
    return match[1];
  }

  return undefined;
}

/**
 * Vérifie si un numéro de registre est valide
 */
export function isValidNumeroRegistre(numero: string | undefined): boolean {
  if (!numero) return false;
  return MSSS_NUMERO_PATTERN.test(numero);
}

/**
 * Vérifie si un NEQ est valide
 */
export function isValidNEQ(neq: string | undefined): boolean {
  if (!neq) return false;
  // Nettoyer le NEQ (enlever espaces et tirets)
  const cleanNEQ = neq.replace(/[\s-]/g, '');
  return NEQ_PATTERN.test(cleanNEQ);
}

/**
 * Normalise un NEQ (supprime espaces et tirets)
 */
export function normalizeNEQ(neq: string | undefined): string | undefined {
  if (!neq) return undefined;
  return neq.replace(/[\s-]/g, '');
}

/**
 * Construit l'URL REQ à partir d'un NEQ
 */
export function buildREQUrl(neq: string | undefined): string | undefined {
  const normalized = normalizeNEQ(neq);
  if (!normalized || !isValidNEQ(normalized)) return undefined;
  return `${REQ_BASE_URL}${normalized}`;
}

/**
 * Vérifie si une URL est une URL valide (format basique)
 */
export function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    // Ajouter https:// si absent
    const urlToTest = url.startsWith('http') ? url : `https://${url}`;
    new URL(urlToTest);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalise une URL (ajoute https:// si absent)
 */
export function normalizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Construit la structure sourcesExternes à partir des champs existants
 *
 * @param residence - Les champs de la résidence à analyser
 * @returns La structure sourcesExternes normalisée
 *
 * @example
 * ```ts
 * const residence = {
 *   siteInternetRegistre: 'https://santemonteregie.qc.ca/rpa/12345',
 *   neq: '1171234567',
 *   siteWeb: 'www.maresidence.com'
 * };
 *
 * const sources = buildSourcesExternesFromResidence(residence);
 * // {
 * //   registreRPA: { url: '...', numero: '12345', isRecognized: true, lastCheckedAt: '...' },
 * //   req: { neq: '1171234567', url: '...', isRecognized: true, lastCheckedAt: '...' },
 * //   siteWeb: { url: 'https://www.maresidence.com', isRecognized: true, lastCheckedAt: '...' }
 * // }
 * ```
 */
export function buildSourcesExternesFromResidence(
  residence: ResidenceSourceFields
): SourcesExternes {
  const now = new Date().toISOString();
  const sources: SourcesExternes = {};

  // -------------------------------------------------------------------------
  // 1. Registre RPA (MSSS)
  // -------------------------------------------------------------------------
  const registreRPA = buildRegistreRPA(residence, now);
  if (registreRPA) {
    sources.registreRPA = registreRPA;
  }

  // -------------------------------------------------------------------------
  // 2. REQ (Registraire des entreprises)
  // -------------------------------------------------------------------------
  const req = buildREQ(residence, now);
  if (req) {
    sources.req = req;
  }

  // -------------------------------------------------------------------------
  // 3. Site Web de la résidence
  // -------------------------------------------------------------------------
  const siteWeb = buildSiteWeb(residence, now);
  if (siteWeb) {
    sources.siteWeb = siteWeb;
  }

  return sources;
}

/**
 * Construit la source Registre RPA à partir des champs existants
 */
function buildRegistreRPA(
  residence: ResidenceSourceFields,
  timestamp: string
): SourceRegistreRPA | undefined {
  const url = residence.siteInternetRegistre;
  const numero = residence.numeroRegistre || residence.numeroRegistreMSSS;

  // Si aucune donnée, pas de source
  if (!url && !numero) {
    return undefined;
  }

  // Extraire le numéro de l'URL si possible
  const numeroFromUrl = extractNumeroFromMSSSUrl(url);
  const finalNumero = numero || numeroFromUrl;

  // Déterminer si la source est reconnue
  const hasValidUrl = isMSSSUrl(url);
  const hasValidNumero = isValidNumeroRegistre(finalNumero);
  const isRecognized = hasValidUrl || hasValidNumero;

  return {
    url: url || undefined,
    numero: finalNumero || undefined,
    isRecognized,
    lastCheckedAt: timestamp,
  };
}

/**
 * Construit la source REQ à partir du NEQ
 */
function buildREQ(
  residence: ResidenceSourceFields,
  timestamp: string
): SourceREQ | undefined {
  const neq = residence.neq;

  // Si pas de NEQ, pas de source
  if (!neq) {
    return undefined;
  }

  const normalizedNEQ = normalizeNEQ(neq);
  const isRecognized = isValidNEQ(normalizedNEQ);
  const url = buildREQUrl(normalizedNEQ);

  return {
    neq: normalizedNEQ,
    url: url || undefined,
    isRecognized,
    lastCheckedAt: timestamp,
  };
}

/**
 * Construit la source Site Web à partir des champs existants
 */
function buildSiteWeb(
  residence: ResidenceSourceFields,
  timestamp: string
): SourceSiteWeb | undefined {
  // Priorité: siteWeb > websiteUrl > siteInternetResidence
  const rawUrl = residence.siteWeb || residence.websiteUrl || residence.siteInternetResidence;

  // Si pas d'URL, pas de source
  if (!rawUrl) {
    return undefined;
  }

  const normalizedUrl = normalizeUrl(rawUrl);
  const isRecognized = isValidUrl(normalizedUrl);

  return {
    url: normalizedUrl,
    isRecognized,
    lastCheckedAt: timestamp,
  };
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Vérifie si une résidence a des sources externes
 */
export function hasSourcesExternes(sources: SourcesExternes | undefined): boolean {
  if (!sources) return false;
  return !!(sources.registreRPA || sources.req || sources.siteWeb);
}

/**
 * Compte le nombre de sources reconnues
 */
export function countRecognizedSources(sources: SourcesExternes | undefined): number {
  if (!sources) return 0;

  let count = 0;
  if (sources.registreRPA?.isRecognized) count++;
  if (sources.req?.isRecognized) count++;
  if (sources.siteWeb?.isRecognized) count++;

  return count;
}

/**
 * Retourne un résumé des sources pour affichage
 */
export function getSourcesSummary(sources: SourcesExternes | undefined): string[] {
  if (!sources) return [];

  const summary: string[] = [];

  if (sources.registreRPA) {
    const status = sources.registreRPA.isRecognized ? '✓' : '?';
    summary.push(`${status} Registre MSSS${sources.registreRPA.numero ? ` (#${sources.registreRPA.numero})` : ''}`);
  }

  if (sources.req) {
    const status = sources.req.isRecognized ? '✓' : '?';
    summary.push(`${status} REQ${sources.req.neq ? ` (${sources.req.neq})` : ''}`);
  }

  if (sources.siteWeb) {
    const status = sources.siteWeb.isRecognized ? '✓' : '?';
    summary.push(`${status} Site web`);
  }

  return summary;
}
