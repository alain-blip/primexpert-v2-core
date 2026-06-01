export interface RneTgaValuationInput {
  revenuNetExploitation: number | null | undefined;
  tgaPct: number | null | undefined;
}

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Valorisation financière SSOT depuis RNE et taux de capitalisation global (TGA). */
export function calculateValueFromRneAndTga({
  revenuNetExploitation,
  tgaPct,
}: RneTgaValuationInput): number | null {
  const rne = finitePositive(revenuNetExploitation);
  const rate = finitePositive(tgaPct);
  if (rne == null || rate == null) return null;

  const normalizedRatePct = rate <= 1 ? rate * 100 : rate;
  return rne / (normalizedRatePct / 100);
}
