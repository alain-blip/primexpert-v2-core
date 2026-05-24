/**
 * Conversion sécurisée en nombre positif — aligné legacy residenceNormalization.
 * Aucun fallback vers 0 : valeur invalide → null.
 */

export function toPositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  let num: number;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '').trim();
    if (cleaned === '') return null;
    num = Number(cleaned);
  } else {
    num = Number(value);
  }

  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}
