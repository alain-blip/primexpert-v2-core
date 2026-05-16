/**
 * Parsing numérique fail-safe — montants, taux et pourcentages (fr-CA / en).
 */

/**
 * Nettoie une valeur monétaire ou numérique :
 * - retire espaces, $, CAD, symboles
 * - gère « 1 234 567 », « 1 234 567,50 », « 1,234,567.89 »
 */
export function safeNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  let s = String(value).trim();
  if (!s) return null;

  s = s
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/[$€£]|CAD|USD/gi, '')
    .trim();

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      s = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
    } else {
      s = s.replace(/,/g, '');
    }
  }

  s = s.replace(/[^\d.-]/g, '');
  const dotParts = s.split('.');
  if (dotParts.length > 2) {
    s = `${dotParts[0]}.${dotParts.slice(1).join('')}`;
  }

  if (s === '' || s === '-' || s === '.') return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Taux ou ratio en % (ex. 6.5, « 6,5 % », 0.065) → nombre en points de pourcentage (6.5). */
export function safeRatePercent(value: unknown, fallbackPct: number): number {
  const n = safeNum(value);
  if (n == null) return fallbackPct;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

/** LTV / ratio : 65, « 65 % », 0.65 → décimal 0.65. */
export function safeRatioDecimal(value: unknown, fallback: number): number {
  const n = safeNum(value);
  if (n == null || n === 0) return fallback;
  return n > 1 ? n / 100 : n;
}

/** DSCR cible : accepte 1.3, « 1,30 », rejette valeurs ≤ 0. */
export function safeDscrTarget(value: unknown, fallback: number): number {
  const n = safeNum(value);
  if (n == null || n <= 0) return fallback;
  return n;
}
