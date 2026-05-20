/**
 * Utilitaires de parsing Firestore partagés — transaction / promesse d'achat.
 * SSOT pour éviter la duplication entre offreTronc, offreConditions, offreCloture, promesseAchatEngine.
 */

import type { TernaryBool } from './offreConditions';

export function toNumber(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n =
    typeof raw === 'number'
      ? raw
      : Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export function toString(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s.length > 0 ? s : undefined;
}

export function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toIsoDateString(raw: unknown): string | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const t = Date.parse(trimmed);
    if (Number.isFinite(t)) return isoFromDate(new Date(t));
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (typeof o.toMillis === 'function') {
      try {
        return isoFromDate(new Date((o.toMillis as () => number)()));
      } catch {
        return undefined;
      }
    }
    if (typeof o.seconds === 'number') {
      return isoFromDate(new Date(o.seconds * 1000));
    }
  }
  return undefined;
}

export function toTernaryBool(raw: unknown): TernaryBool {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  if (typeof raw === 'string') {
    const norm = raw.trim().toLowerCase();
    if (['true', 'oui', 'yes', '1', 'o'].includes(norm)) return true;
    if (['false', 'non', 'no', '0', 'n'].includes(norm)) return false;
  }
  return null;
}

export function readNested(doc: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = doc;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function firstNumber(sources: unknown[]): number | undefined {
  for (const raw of sources) {
    const n = toNumber(raw);
    if (n != null) return n;
  }
  return undefined;
}

export function firstString(sources: unknown[]): string | undefined {
  for (const raw of sources) {
    const s = toString(raw);
    if (s) return s;
  }
  return undefined;
}

export function firstIso(sources: unknown[]): string | undefined {
  for (const raw of sources) {
    const iso = toIsoDateString(raw);
    if (iso) return iso;
  }
  return undefined;
}

export function firstTernary(sources: unknown[]): TernaryBool {
  for (const raw of sources) {
    if (raw === undefined || raw === null || raw === '') continue;
    return toTernaryBool(raw);
  }
  return null;
}
