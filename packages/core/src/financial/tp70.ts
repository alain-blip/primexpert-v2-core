/**
 * TP70 — Taux de pénétration 70+ (port Copilote marketContextUtils).
 * Indicateur qualitatif uniquement — aucun impact sur la valorisation.
 */

import { REGIONS_QUEBEC, type QuebecRegionRow } from './regionsQuebec';

export const TP70_GLOSSARY = {
  label: 'TP70 (Penetration Rate 70+)',
  labelFr: 'TP70 — Taux de pénétration 70+',
  definition: 'Taux de pénétration régional – 70 ans et plus',
  formula: 'Unités RPA région ÷ Population région 70+',
  interpretation:
    'Indicateur de maturité du marché RPA. Un taux bas suggère un potentiel de croissance.',
  source: 'ISQ (population) / MSSS (unités RPA)',
  disclaimer:
    'Indicateur complémentaire à titre informatif. Non utilisé comme critère de souscription bancaire.',
} as const;

export const BENCHMARK_QC_70PLUS = (() => {
  const totals = Object.values(REGIONS_QUEBEC).reduce(
    (acc, r) => ({
      population: acc.population + r.population70plus,
      units: acc.units + r.rpaUnits,
    }),
    { population: 0, units: 0 }
  );
  return {
    value: totals.population > 0 ? totals.units / totals.population : 0.08,
    population70plus: totals.population,
    rpaUnits: totals.units,
    refYear: 2024,
  };
})();

const TP70_THRESHOLDS = { LOW_MARGIN: 0.015, HIGH_MARGIN: 0.015 };

export type TP70InterpretationCode = 'UNDER_PENETRATED' | 'MATURE' | 'AVERAGE';

export interface TP70Interpretation {
  code: TP70InterpretationCode;
  text: string;
  shortText: string;
  color: string;
}

export interface TP70Result {
  tp70: number | null;
  tp70Label: string;
  regionCode: string | null;
  regionName: string | null;
  population70plus: number | null;
  rpaUnits: number | null;
  benchmark: number;
  benchmarkLabel: string;
  interpretation: string | null;
  interpretationCode: TP70InterpretationCode | null;
  confidenceTier: 'high' | 'low';
  source: { population: string; supply: string } | null;
  refYear: number | null;
}

export interface ResidenceTP70Hints {
  regionSociosanitaire?: string | null;
  region?: string | null;
  ville?: string | null;
  city?: string | null;
  [key: string]: unknown;
}

function normalizeRegionName(regionName: string): string {
  return regionName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim();
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(decimals).replace('.', ',')} %`;
}

export function findRegion(regionInput: string | null | undefined): QuebecRegionRow | null {
  if (!regionInput) return null;
  const input = regionInput.toString().trim();

  if (REGIONS_QUEBEC[input]) return REGIONS_QUEBEC[input];

  const paddedCode = input.padStart(2, '0');
  if (REGIONS_QUEBEC[paddedCode]) return REGIONS_QUEBEC[paddedCode];

  const normalizedInput = normalizeRegionName(input);
  for (const region of Object.values(REGIONS_QUEBEC)) {
    if (normalizeRegionName(region.name) === normalizedInput) return region;
    for (const alias of region.aliases) {
      if (normalizeRegionName(alias) === normalizedInput) return region;
      if (normalizedInput.includes(normalizeRegionName(alias))) return region;
    }
  }
  return null;
}

export function getRegionFromResidence(residence: ResidenceTP70Hints | null | undefined): QuebecRegionRow | null {
  if (!residence) return null;
  const regionName =
    residence.regionSociosanitaire ||
    residence.region ||
    residence.ville ||
    residence.city ||
    null;
  return findRegion(regionName ?? undefined);
}

export function calculateTP70(params: {
  population70plus: number;
  rpaUnits: number;
}): number | null {
  const { population70plus, rpaUnits } = params;
  if (!population70plus || population70plus <= 0 || !rpaUnits || rpaUnits <= 0) return null;
  return rpaUnits / population70plus;
}

export function getTP70Interpretation(
  tp70: number | null,
  benchmark: number
): TP70Interpretation | null {
  if (tp70 === null || benchmark === null) return null;
  const diff = tp70 - benchmark;
  if (diff < -TP70_THRESHOLDS.LOW_MARGIN) {
    return {
      code: 'UNDER_PENETRATED',
      text: 'Marché sous-pénétré → potentiel de croissance de la demande',
      shortText: 'Sous-pénétré',
      color: '#2e7d32',
    };
  }
  if (diff > TP70_THRESHOLDS.HIGH_MARGIN) {
    return {
      code: 'MATURE',
      text: 'Marché mature → croissance plus limitée',
      shortText: 'Mature',
      color: '#f57c00',
    };
  }
  return {
    code: 'AVERAGE',
    text: 'Marché dans la moyenne → dynamique stable',
    shortText: 'Dans la moyenne',
    color: '#1565c0',
  };
}

/**
 * Sentinelle anti-drift TP70.
 * Retourne `true` si l'année de référence est plus vieille que `thresholdMonths`
 * (défaut : 18 mois) par rapport à la date courante. L'ancrage temporel est
 * fin décembre de `refYear` — le plus conservateur (favorise un avertissement
 * dès qu'une fiche traverse un cycle annuel sans rafraîchissement).
 */
export function isDataStale(
  refYear: number | null | undefined,
  options: { thresholdMonths?: number; now?: Date } = {}
): boolean {
  if (!refYear || !Number.isFinite(refYear)) return true;
  const thresholdMonths = options.thresholdMonths ?? 18;
  const now = options.now ?? new Date();
  const referenceDate = new Date(refYear, 11, 31);
  const monthsElapsed =
    (now.getFullYear() - referenceDate.getFullYear()) * 12 +
    (now.getMonth() - referenceDate.getMonth());
  return monthsElapsed > thresholdMonths;
}

export function calculateTP70FromResidence(residence: ResidenceTP70Hints): TP70Result {
  const region = getRegionFromResidence(residence);

  if (!region) {
    return {
      tp70: null,
      tp70Label: '—',
      regionCode: null,
      regionName: null,
      population70plus: null,
      rpaUnits: null,
      benchmark: BENCHMARK_QC_70PLUS.value,
      benchmarkLabel: formatPercent(BENCHMARK_QC_70PLUS.value),
      interpretation: null,
      interpretationCode: null,
      confidenceTier: 'low',
      source: null,
      refYear: null,
    };
  }

  const tp70 = calculateTP70({
    population70plus: region.population70plus,
    rpaUnits: region.rpaUnits,
  });
  const interpretation = getTP70Interpretation(tp70, BENCHMARK_QC_70PLUS.value);

  return {
    tp70,
    tp70Label: tp70 != null ? formatPercent(tp70) : '—',
    regionCode: region.code,
    regionName: region.name,
    population70plus: region.population70plus,
    rpaUnits: region.rpaUnits,
    benchmark: BENCHMARK_QC_70PLUS.value,
    benchmarkLabel: formatPercent(BENCHMARK_QC_70PLUS.value),
    interpretation: interpretation?.text ?? null,
    interpretationCode: interpretation?.code ?? null,
    confidenceTier: tp70 != null ? 'high' : 'low',
    source: { population: 'ISQ', supply: 'MSSS' },
    refYear: region.refYear,
  };
}
