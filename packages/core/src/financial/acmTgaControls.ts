/**
 * Garde-fous ACM/TGA — centralise les transformations utilisées par l'UI.
 */

const DEFAULT_MANUAL_TGA_TOLERANCE_PCT = 0.04;

function finiteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function positiveNumber(value: unknown): number | null {
  const n = finiteNumber(value);
  return n != null && n > 0 ? n : null;
}

export interface ResolveDynamicMarketTgaPctInput {
  territorialCompetitionMedianTgaPct?: number | null;
  territorialMedianTgaPct?: number | null;
  fallbackTgaPct: number;
}

export function resolveDynamicMarketTgaPct({
  territorialCompetitionMedianTgaPct,
  territorialMedianTgaPct,
  fallbackTgaPct,
}: ResolveDynamicMarketTgaPctInput): number {
  return (
    positiveNumber(territorialCompetitionMedianTgaPct) ??
    positiveNumber(territorialMedianTgaPct) ??
    positiveNumber(fallbackTgaPct) ??
    0
  );
}

export function resolveAppliedTgaPct(input: {
  isManualOverride: boolean;
  manualTgaPct: number;
  marketTgaPct: number;
  qualitativeAdjustmentPct: number;
}): number {
  if (input.isManualOverride) return finiteNumber(input.manualTgaPct) ?? 0;
  return (finiteNumber(input.marketTgaPct) ?? 0) + (finiteNumber(input.qualitativeAdjustmentPct) ?? 0);
}

export function percentToDecimal(valuePct: number): number {
  const n = finiteNumber(valuePct);
  return n == null ? 0 : n / 100;
}

export function decimalToPercent(value: number | null | undefined): number | null {
  const n = finiteNumber(value);
  return n == null ? null : n * 100;
}

export function isManualTgaOverride(input: {
  enteredTgaPct: number;
  automaticTgaPct: number;
  tolerancePct?: number;
}): boolean {
  const entered = finiteNumber(input.enteredTgaPct);
  const automatic = finiteNumber(input.automaticTgaPct);
  if (entered == null || automatic == null) return true;
  return Math.abs(entered - automatic) > (input.tolerancePct ?? DEFAULT_MANUAL_TGA_TOLERANCE_PCT);
}

export function formatTgaPctForInput(valuePct: number, fractionDigits = 2): string {
  const n = finiteNumber(valuePct);
  if (n == null) return '';
  return String(Number(n.toFixed(fractionDigits)));
}

export function formatTgaPct(valuePct: number | null | undefined, fractionDigits = 2): string {
  const n = finiteNumber(valuePct);
  return n == null ? '—' : n.toFixed(fractionDigits);
}

export function formatDecimalTgaPct(value: number | null | undefined, fractionDigits = 2): string {
  const pct = decimalToPercent(value);
  return formatTgaPct(pct, fractionDigits);
}

