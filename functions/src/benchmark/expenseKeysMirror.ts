/**
 * Miroir EXPENSE_KEYS — postes nourrissant le benchmark portefeuille (SSOT V2).
 */
export const EXPENSE_KEYS_BENCHMARK = [
  'mainDOeuvreDirecte',
  'salairesAvantages',
  'nourritures',
  'assurances',
  'taxesMunicipalesScolaire',
  'taxesPermis',
  'energie',
  'entretienReparation',
  'publicite',
  'divers',
  'telecommunications',
  'fournituresBureau',
  'fraisDeplacements',
  'honorairesProfessionnels',
  'fraisRepresentation',
  'fraisGestion',
  'locationEquipements',
] as const;

export type ExpenseKeyBenchmark = (typeof EXPENSE_KEYS_BENCHMARK)[number];

/** Legacy : electricite + gazMazout + chauffage → energie unifiée V2. */
export function declaredAmountForBenchmarkKey(
  dep: Record<string, unknown>,
  key: string
): number {
  if (key === 'energie') {
    const direct = parseNum(dep.energie);
    if (direct > 0) return direct;
    return (
      parseNum(dep.electricite) + parseNum(dep.gazMazout) + parseNum(dep.chauffage)
    );
  }
  return parseNum(dep[key]);
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
