/**
 * Formatage affichage — identité (lecture seule).
 */

import { isFieldEmpty } from './resolveIdentityField';

export function formatIdentityScalar(value: unknown, fallback = '—'): string {
  if (isFieldEmpty(value)) return fallback;
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toLocaleString('fr-CA');
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(String).join(', ') : fallback;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  const s = String(value).trim();
  return s || fallback;
}

export function formatPercentDisplay(value: unknown): string | null {
  if (isFieldEmpty(value)) return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return `${pct.toFixed(1)} %`;
}

export function formatAddressLine(doc: Record<string, unknown>): string | null {
  const parts = [
    doc.address ?? doc.adresse,
    doc.municipalite ?? doc.ville ?? doc.city,
    doc.codePostal,
  ]
    .map((p) => (p != null ? String(p).trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function formatRegionPrincipal(doc: Record<string, unknown>): string | null {
  const direct = doc.regionSociosanitaire ?? doc.region;
  if (typeof direct === 'string' && direct.trim()) {
    return direct.split(',')[0]?.trim() ?? direct.trim();
  }
  if (Array.isArray(doc.regions) && doc.regions.length > 0) {
    return String(doc.regions[0]);
  }
  return null;
}
