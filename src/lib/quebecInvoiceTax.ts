/** TPS fédérale (5 %) et TVQ (9,975 %) sur le sous-total HT au Québec. */
export const TPS_RATE = 0.05;
export const TVQ_RATE = 0.09975;

export interface QuebecTaxBreakdown {
  subtotalCad: number;
  tpsCad: number;
  tvqCad: number;
  totalCad: number;
}

/** Arrondi à 2 décimales (monnaie CAD). */
export function roundCad(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function computeQuebecTaxes(subtotalCad: number): QuebecTaxBreakdown {
  const subtotal = roundCad(subtotalCad);
  const tpsCad = roundCad(subtotal * TPS_RATE);
  const tvqCad = roundCad(subtotal * TVQ_RATE);
  const totalCad = roundCad(subtotal + tpsCad + tvqCad);
  return { subtotalCad: subtotal, tpsCad, tvqCad, totalCad };
}

export function formatCadAmount(amount: number, locale: 'fr' | 'en' = 'fr'): string {
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} $`;
  }
}
