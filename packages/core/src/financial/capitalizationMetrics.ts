import { formatPercentRaw } from '../utils/formatting';
import { safeNum, safePositiveNum } from './safeNumbers';

export function normalizeCapitalizationRate(value: unknown): number | null {
  const rate = safePositiveNum(value);
  if (rate == null) return null;
  if (rate > 1 && rate <= 100) return rate / 100;
  return rate <= 1 ? rate : null;
}

export function computeCapitalizationRateFromNoi(
  noi: unknown,
  price: unknown
): number | null {
  const safeNoi = safePositiveNum(noi);
  const safePrice = safePositiveNum(price);
  if (safeNoi == null || safePrice == null) return null;
  return safeNoi / safePrice;
}

export function computeCapitalizedValueFromNoi(
  noi: unknown,
  capitalizationRate: unknown
): number | null {
  const safeNoi = safePositiveNum(noi);
  const safeRate = normalizeCapitalizationRate(capitalizationRate);
  if (safeNoi == null || safeRate == null) return null;
  return safeNoi / safeRate;
}

export function capitalizationRateToPercent(value: unknown): number | null {
  const rate = normalizeCapitalizationRate(value);
  return rate == null ? null : rate * 100;
}

export function formatCapitalizationRatePercent(
  value: unknown,
  decimals = 2,
  fallback = '—'
): string {
  const percent = capitalizationRateToPercent(value);
  return percent == null ? fallback : formatPercentRaw(percent, decimals);
}

export function capitalizationRateDeltaToPercent(value: unknown): number | null {
  const delta = safeNum(value);
  return delta == null ? null : delta * 100;
}

export function formatCapitalizationRateDeltaPercent(
  value: unknown,
  decimals = 2,
  fallback = '—'
): string {
  const percent = capitalizationRateDeltaToPercent(value);
  return percent == null ? fallback : formatPercentRaw(percent, decimals);
}

export function isCapitalizationRatePctAdjusted(
  candidatePct: unknown,
  referencePct: unknown,
  thresholdPct = 0.04
): boolean {
  const candidate = safePositiveNum(candidatePct);
  const reference = safePositiveNum(referencePct);
  const threshold = safePositiveNum(thresholdPct) ?? 0;
  if (candidate == null || reference == null) return false;
  return Math.abs(candidate - reference) > threshold;
}

export function computeNoiVarianceRatio(
  firstNoi: unknown,
  secondNoi: unknown
): number | null {
  const first = safePositiveNum(firstNoi);
  const second = safePositiveNum(secondNoi);
  if (first == null || second == null) return null;
  return Math.abs(first - second) / Math.max(first, second);
}

export function formatNoiVariancePercent(
  varianceRatio: unknown,
  decimals = 1,
  fallback = '—'
): string {
  const variance = safeNum(varianceRatio);
  if (variance == null || variance < 0) return fallback;
  return formatPercentRaw(variance * 100, decimals);
}
