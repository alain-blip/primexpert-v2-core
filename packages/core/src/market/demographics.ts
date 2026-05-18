/**
 * Bassin démographique local — main-d'œuvre et clientèle 75+.
 */

import { getRegionFromResidence } from '../financial/tp70';

export interface MarcheDemographie {
  population15_24?: number | null;
  population25_54?: number | null;
  population75_plus?: number | null;
  source?: string;
  updatedAt?: string;
}

export interface ResolvedDemographics {
  population15_24: number | null;
  population25_54: number | null;
  population75_plus: number | null;
  population75_source: 'document' | 'regional_reference' | 'none';
  regionalName: string | null;
}

function readNestedDemographics(doc: Record<string, unknown> | null): MarcheDemographie {
  const nested = doc?.marcheDemographie;
  if (nested && typeof nested === 'object') {
    return nested as MarcheDemographie;
  }
  return {};
}

function readNumber(doc: Record<string, unknown> | null, keys: string[]): number | null {
  if (!doc) return null;
  for (const key of keys) {
    const n = Number(doc[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function resolveMarcheDemographics(
  doc: Record<string, unknown> | null
): ResolvedDemographics {
  const nested = readNestedDemographics(doc);
  const region = getRegionFromResidence(doc ?? undefined);

  const population15_24 =
    nested.population15_24 ??
    readNumber(doc, ['population15_24', 'population15_24Ans', 'population1524']);

  const population25_54 =
    nested.population25_54 ??
    readNumber(doc, ['population25_54', 'population25_54Ans', 'population2554']);

  let population75_plus =
    nested.population75_plus ??
    readNumber(doc, [
      'population75_plus',
      'population75Plus',
      'population75_plusAns',
      'population75PlusAns',
    ]);

  let population75_source: ResolvedDemographics['population75_source'] = 'none';

  if (population75_plus != null) {
    population75_source = 'document';
  } else if (region?.population70plus) {
    population75_plus = region.population70plus;
    population75_source = 'regional_reference';
  }

  return {
    population15_24,
    population25_54,
    population75_plus,
    population75_source,
    regionalName: region?.name ?? null,
  };
}

export function formatPopulationCount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('fr-CA');
}

export function buildMarcheDemographiePatch(
  current: MarcheDemographie | undefined,
  field: keyof Pick<MarcheDemographie, 'population15_24' | 'population25_54' | 'population75_plus'>,
  raw: string
): { marcheDemographie: MarcheDemographie } {
  const parsed = raw.trim() === '' ? null : Number(raw.replace(/\s/g, '').replace(',', '.'));
  const value = parsed != null && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  return {
    marcheDemographie: {
      ...current,
      [field]: value,
      updatedAt: new Date().toISOString(),
      source: 'manual_ui',
    },
  };
}
