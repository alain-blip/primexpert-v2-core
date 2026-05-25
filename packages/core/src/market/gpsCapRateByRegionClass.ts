/**
 * TGA médian GPS — filtrage par région administrative et classe RPA.
 */

import { median, type MarketGpsTransaction } from './marketGpsViewModel';
import { coerceToGpsFilterRegion, normalizeAdministrativeRegion } from './marketRegionNormalize';

export type GpsCapRateSource =
  | 'REGION_CLASS'
  | 'REGION'
  | 'CLASS'
  | 'GLOBAL'
  | 'FALLBACK';

export interface GpsCapRateSelection {
  capRatePct: number;
  source: GpsCapRateSource;
  sampleCount: number;
  regionLabel: string | null;
  assetClassLabel: string | null;
  rationaleFr: string;
  rationaleEn: string;
}

const ROMAN_TO_DIGIT: Record<string, string> = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
};

/** Normalise vers « Classe 1 » … « Classe 4 ». */
export function normalizeRpaBuildingClass(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const digitMatch = s.match(/classe\s*([1-4])\b/i);
  if (digitMatch) return `Classe ${digitMatch[1]}`;

  const romanMatch = s.match(/classe\s*(i{1,3}|iv)\b/i);
  if (romanMatch) {
    const digit = ROMAN_TO_DIGIT[romanMatch[1]!.toLowerCase()];
    if (digit) return `Classe ${digit}`;
  }

  if (/^[1-4]$/.test(s)) return `Classe ${s}`;

  const loose = s.match(/\b([1-4])\b/);
  if (loose && /classe|niveau|soins|rpa/i.test(s)) return `Classe ${loose[1]}`;

  return null;
}

export function resolveResidenceRpaBuildingClass(
  residenceDoc?: Record<string, unknown> | null,
  residence?: { nicheMetadata?: { rpaFields?: { careLevel?: string } } }
): string | null {
  const niche = residence?.nicheMetadata?.rpaFields?.careLevel;
  const candidates = [
    residenceDoc?.classeImmeuble,
    residenceDoc?.classe_immeuble,
    residenceDoc?.classeRpa,
    residenceDoc?.niveauSoins,
    residenceDoc?.careLevel,
    residenceDoc?.niveauSoinsRpa,
    niche,
  ];
  for (const c of candidates) {
    const normalized = normalizeRpaBuildingClass(c);
    if (normalized) return normalized;
  }
  return null;
}

function regionsMatch(
  tx: MarketGpsTransaction,
  region: string,
  city?: string
): boolean {
  const target = normalizeAdministrativeRegion(
    coerceToGpsFilterRegion(region, city),
    city
  );
  const txRegion = normalizeAdministrativeRegion(
    coerceToGpsFilterRegion(tx.region, tx.city),
    tx.city
  );
  return target !== '—' && txRegion !== '—' && target === txRegion;
}

function classMatches(tx: MarketGpsTransaction, buildingClass: string): boolean {
  const txClass = normalizeRpaBuildingClass(tx.classeImmeuble ?? tx.typeImmeuble);
  return txClass != null && txClass === buildingClass;
}

function medianTgaPct(rows: MarketGpsTransaction[]): number | null {
  const vals = rows
    .map((t) => t.tgaPct)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  const m = median(vals);
  return m != null ? Math.round(m * 100) / 100 : null;
}

function fmtPctFr(pct: number): string {
  return `${pct.toFixed(2).replace('.', ',')} %`;
}

function fmtPctEn(pct: number): string {
  return `${pct.toFixed(2)}%`;
}

function buildResult(
  capRatePct: number,
  source: GpsCapRateSource,
  sampleCount: number,
  regionLabel: string | null,
  assetClassLabel: string | null
): GpsCapRateSelection {
  const region = regionLabel ?? 'Québec';
  const assetClass = assetClassLabel ?? 'RPA';

  let rationaleFr: string;
  let rationaleEn: string;

  switch (source) {
    case 'REGION_CLASS':
      rationaleFr = `TGA de base de ${fmtPctFr(capRatePct)} (basé sur les RPA ${assetClass} en ${region}).`;
      rationaleEn = `Base cap rate of ${fmtPctEn(capRatePct)} (based on ${assetClass} care homes in ${region}).`;
      break;
    case 'REGION':
      rationaleFr = `TGA de base de ${fmtPctFr(capRatePct)} (médiane GPS — ${region}, toutes classes).`;
      rationaleEn = `Base cap rate of ${fmtPctEn(capRatePct)} (GPS median — ${region}, all classes).`;
      break;
    case 'CLASS':
      rationaleFr = `TGA de base de ${fmtPctFr(capRatePct)} (médiane GPS — ${assetClass}, toutes régions).`;
      rationaleEn = `Base cap rate of ${fmtPctEn(capRatePct)} (GPS median — ${assetClass}, all regions).`;
      break;
    case 'GLOBAL':
      rationaleFr = `TGA de base de ${fmtPctFr(capRatePct)} (médiane GPS — marché RPA provincial).`;
      rationaleEn = `Base cap rate of ${fmtPctEn(capRatePct)} (GPS median — provincial RPA market).`;
      break;
    default:
      rationaleFr = `TGA de base de ${fmtPctFr(capRatePct)} (valeur de repli — données GPS insuffisantes).`;
      rationaleEn = `Base cap rate of ${fmtPctEn(capRatePct)} (fallback — insufficient GPS data).`;
  }

  return {
    capRatePct,
    source,
    sampleCount,
    regionLabel,
    assetClassLabel,
    rationaleFr,
    rationaleEn,
  };
}

/**
 * Sélectionne le TGA médian GPS avec cascade région+classe → région → classe → global → repli.
 */
export function selectGpsCapRateMedian(params: {
  transactions: MarketGpsTransaction[];
  region: string;
  city?: string;
  buildingClass?: string | null;
  fallbackPct?: number;
  minSamples?: number;
}): GpsCapRateSelection {
  const minSamples = params.minSamples ?? 3;
  const fallbackPct = params.fallbackPct ?? 8.5;
  const regionLabel = normalizeAdministrativeRegion(
    coerceToGpsFilterRegion(params.region, params.city),
    params.city
  );
  const assetClassLabel = params.buildingClass
    ? normalizeRpaBuildingClass(params.buildingClass)
    : null;

  const valid = params.transactions.filter(
    (t) => t.tgaPct != null && Number.isFinite(t.tgaPct) && t.tgaPct > 0
  );

  if (assetClassLabel) {
    const regionClass = valid.filter(
      (t) => regionsMatch(t, params.region, params.city) && classMatches(t, assetClassLabel)
    );
    const m = medianTgaPct(regionClass);
    if (m != null && regionClass.length >= minSamples) {
      return buildResult(
        m,
        'REGION_CLASS',
        regionClass.length,
        regionLabel,
        assetClassLabel
      );
    }
  }

  const regionOnly = valid.filter((t) => regionsMatch(t, params.region, params.city));
  const regionMedian = medianTgaPct(regionOnly);
  if (regionMedian != null && regionOnly.length >= minSamples) {
    return buildResult(
      regionMedian,
      'REGION',
      regionOnly.length,
      regionLabel,
      assetClassLabel
    );
  }

  if (assetClassLabel) {
    const classOnly = valid.filter((t) => classMatches(t, assetClassLabel));
    const classMedian = medianTgaPct(classOnly);
    if (classMedian != null && classOnly.length >= minSamples) {
      return buildResult(
        classMedian,
        'CLASS',
        classOnly.length,
        regionLabel,
        assetClassLabel
      );
    }
  }

  const globalMedian = medianTgaPct(valid);
  if (globalMedian != null && valid.length >= minSamples) {
    return buildResult(globalMedian, 'GLOBAL', valid.length, regionLabel, assetClassLabel);
  }

  return buildResult(
    fallbackPct,
    'FALLBACK',
    0,
    regionLabel,
    assetClassLabel
  );
}
