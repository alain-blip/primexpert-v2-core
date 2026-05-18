/**
 * Badge Raphaël ✨ — règles d'affichage MSSS.
 */

import { getNestedValue, isFieldEmpty } from './resolveIdentityField';

export interface MsssEnrichmentDoc {
  lastEnriched?: unknown;
  source?: string;
  numeroRegistre?: string;
  detailsScraped?: boolean;
  confidence?: number;
}

export function getMsssEnrichment(
  doc: Record<string, unknown> | null | undefined
): MsssEnrichmentDoc | null {
  const raw = doc?.msssEnrichment;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as MsssEnrichmentDoc;
}

export function hasMsssEnrichment(doc: Record<string, unknown> | null | undefined): boolean {
  return getMsssEnrichment(doc) != null;
}

/** Confirmation manuelle courtier (Phase 4b) — coupe le badge ✨ sur ce champ. */
export function isFieldConfirmedByUser(
  doc: Record<string, unknown> | null | undefined,
  fieldId: string
): boolean {
  if (!doc) return false;
  const conf = doc.identityConfirmations;
  if (conf && typeof conf === 'object' && !Array.isArray(conf)) {
    const entry = (conf as Record<string, unknown>)[fieldId];
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return (entry as Record<string, unknown>).confirmedBy === 'user';
    }
  }
  return false;
}

export interface RaphaelBadgeContext {
  /** Valeur brute du champ (racine ou imbriquée). */
  value?: unknown;
  /** `confirmedBy` sur un sous-objet (effectifs, clientele, immeuble). */
  confirmedBy?: unknown;
  /** Forcer vide même si une valeur existe (ex. section entière). */
  forceEmpty?: boolean;
}

/**
 * Afficher ✨ si (champ vide OU non confirmé) ET enrichissement MSSS disponible.
 */
export function shouldShowRaphaelBadge(
  doc: Record<string, unknown> | null | undefined,
  ctx: RaphaelBadgeContext = {}
): boolean {
  if (!hasMsssEnrichment(doc)) return false;
  if (ctx.confirmedBy === 'user') return false;

  const empty = ctx.forceEmpty ?? isFieldEmpty(ctx.value);
  const unconfirmed =
    ctx.confirmedBy === undefined ||
    ctx.confirmedBy === null ||
    ctx.confirmedBy === '';

  return empty || unconfirmed;
}

export function shouldShowRaphaelForField(
  doc: Record<string, unknown> | null | undefined,
  fieldId: string,
  ctx: RaphaelBadgeContext = {}
): boolean {
  if (isFieldConfirmedByUser(doc, fieldId)) return false;
  return shouldShowRaphaelBadge(doc, ctx);
}

export function shouldShowRaphaelForPath(
  doc: Record<string, unknown> | null | undefined,
  path: string[]
): boolean {
  const leafKey = path[path.length - 1];
  if (isFieldConfirmedByUser(doc, leafKey)) return false;

  const value = getNestedValue(doc, path);
  const parentKey = path.length > 1 ? path[0] : null;
  const parent = parentKey ? getNestedValue(doc, [parentKey]) : null;
  const confirmedBy =
    parent && typeof parent === 'object' && !Array.isArray(parent)
      ? (parent as Record<string, unknown>).confirmedBy
      : undefined;

  return shouldShowRaphaelBadge(doc, { value, confirmedBy });
}
