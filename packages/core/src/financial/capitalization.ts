export interface RneFromRbeOpexInput {
  revenuBrutEffectif: number | null | undefined;
  depensesExploitation: number | null | undefined;
}

export interface TgaFromRnePriceInput {
  revenuNetExploitation: number | null | undefined;
  prix: number | null | undefined;
}

export interface ValueFromRneTgaInput {
  revenuNetExploitation: number | null | undefined;
  tgaPct: number | null | undefined;
}

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Calcule le revenu net d'exploitation (RNE) canonique depuis RBE et OPEX. */
export function calculateRneFromRbeAndOpex({
  revenuBrutEffectif,
  depensesExploitation,
}: RneFromRbeOpexInput): number | null {
  const rbe = finitePositive(revenuBrutEffectif);
  if (rbe == null || depensesExploitation == null || !Number.isFinite(depensesExploitation)) {
    return null;
  }
  return Math.round(rbe - depensesExploitation);
}

/** Calcule le taux de capitalisation global (TGA) décimal depuis RNE et prix. */
export function calculateTgaFromRneAndPrice({
  revenuNetExploitation,
  prix,
}: TgaFromRnePriceInput): number | null {
  const rne = finitePositive(revenuNetExploitation);
  const price = finitePositive(prix);
  if (rne == null || price == null) return null;
  return rne / price;
}

/** Valorisation financière SSOT depuis RNE et taux de capitalisation global (TGA). */
export function calculateValueFromRneAndTga({
  revenuNetExploitation,
  tgaPct,
}: ValueFromRneTgaInput): number | null {
  const rne = finitePositive(revenuNetExploitation);
  const rate = finitePositive(tgaPct);
  if (rne == null || rate == null) return null;

  const normalizedRatePct = rate <= 1 ? rate * 100 : rate;
  return rne / (normalizedRatePct / 100);
}
