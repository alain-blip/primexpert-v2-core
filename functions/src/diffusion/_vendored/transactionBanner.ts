/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 *
 * Source canonique : packages/core/src/diffusion/
 * Régénéré par   : functions/scripts/sync-core-diffusion.cjs (prebuild)
 */
/**
 * Bandeaux transaction CRM + statut ACF WordPress (sous offre / vendu).
 */

export type TransactionBannerKind = 'pa_acceptee' | 'vendu' | null;

/** Valeurs ACF historiques RPAaVendre.com (`acfListingStatus`). */
export type AcfListingTransactionStatus =
  | 'disponible'
  | 'sous_offre'
  | 'vendu';

export interface TransactionPublicationInput {
  stage?: string | null;
  status?: string | null;
  pipelineStatus?: string | null;
  statut?: string | null;
  dateNotairePrevu?: string | null;
  promesseAchat?: {
    statut?: string | null;
    dateNotairePrevue?: string | null;
    dateNotaire?: string | null;
  } | null;
}

export interface TransactionBannerViewModel {
  kind: TransactionBannerKind;
  /** ISO yyyy-mm-dd pour affichage formaté. */
  dateNotaireIso: string | null;
}

function normalizeToken(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');
}

function parseIsoDateOnly(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return null;
  return trimmed.slice(0, 10);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDateOnOrAfterToday(isoDate: string, now: Date): boolean {
  const parts = isoDate.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return false;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  return startOfLocalDay(target).getTime() >= startOfLocalDay(now).getTime();
}

function resolveStageToken(input: TransactionPublicationInput): string {
  return normalizeToken(
    input.stage ?? input.pipelineStatus ?? input.statut ?? input.status
  );
}

function resolvePromesseStatut(input: TransactionPublicationInput): string {
  return normalizeToken(input.promesseAchat?.statut);
}

function resolveNotaireDateIso(input: TransactionPublicationInput): string | null {
  return (
    parseIsoDateOnly(input.dateNotairePrevu) ??
    parseIsoDateOnly(input.promesseAchat?.dateNotairePrevue) ??
    parseIsoDateOnly(input.promesseAchat?.dateNotaire) ??
    null
  );
}

function isPaAccepteeStage(stage: string, promesseStatut: string): boolean {
  if (stage === 'PA_ACCEPTEE' || stage === 'PROMESSE_ACCEPTEE') return true;
  if (stage === 'PROMISE' && promesseStatut === 'ACCEPTED') return true;
  return promesseStatut === 'ACCEPTED' || promesseStatut === 'ACCEPTEE';
}

function isClotureStage(stage: string, status: string): boolean {
  if (stage === 'CLOTURE' || stage === 'CLOTUREE' || stage === 'VENDU') return true;
  return status === 'SOLD' || status === 'VENDU';
}

/**
 * Bandeau CRM sous le titre de la fiche résidence.
 */
export function resolveTransactionBanner(
  input: TransactionPublicationInput,
  options: { now?: Date } = {}
): TransactionBannerViewModel {
  const now = options.now ?? new Date();
  const stage = resolveStageToken(input);
  const status = normalizeToken(input.status);
  const promesseStatut = resolvePromesseStatut(input);
  const dateIso = resolveNotaireDateIso(input);

  if (isPaAccepteeStage(stage, promesseStatut)) {
    return { kind: 'pa_acceptee', dateNotaireIso: dateIso };
  }

  if (isClotureStage(stage, status) && dateIso && isDateOnOrAfterToday(dateIso, now)) {
    return { kind: 'vendu', dateNotaireIso: dateIso };
  }

  return { kind: null, dateNotaireIso: dateIso };
}

/**
 * Statut transaction poussé vers WordPress (meta ACF).
 */
export function resolveAcfListingStatus(
  input: TransactionPublicationInput,
  options: { now?: Date } = {}
): AcfListingTransactionStatus {
  const banner = resolveTransactionBanner(input, options);
  if (banner.kind === 'pa_acceptee') return 'sous_offre';
  if (banner.kind === 'vendu') return 'vendu';
  return 'disponible';
}

/**
 * Verrouillage saisie Hub Finance — promesse acceptée ou clôture transaction.
 */
export function isFinanceHubSealed(input: TransactionPublicationInput): boolean {
  const stage = resolveStageToken(input);
  return stage === 'PA_ACCEPTEE' || stage === 'CLOTURE' || stage === 'CLOTUREE';
}
