/**
 * FORMATTING UTILITIES — SOURCE UNIQUE
 *
 * Port TypeScript du `src/utils/formatting.js` de Copilote-RPA (V1).
 * Charte v2026.2 §I — SOURCE UNIQUE.
 *
 * Utilisé en interne par :
 *   - valuation/valuationEngine.ts
 *   - export/buildExportDataset.ts
 */

export interface FormatCurrencyOptions {
  locale?: string;
  currency?: string;
  minDecimals?: number;
  maxDecimals?: number;
  fallback?: string;
  compact?: boolean;
  showSign?: boolean;
}

export function formatCurrency(
  amount: number | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  const {
    locale = 'fr-CA',
    currency = 'CAD',
    minDecimals = 0,
    maxDecimals = 0,
    fallback = 'N/A',
    compact = false,
    showSign = false,
  } = options;

  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return fallback;
  }

  const formatterOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  };

  if (compact) {
    formatterOptions.notation = 'compact';
  }

  let formatted = new Intl.NumberFormat(locale, formatterOptions).format(amount);

  if (showSign && amount > 0) {
    formatted = '+' + formatted;
  }

  return formatted;
}

export const formatPrix = (prix: number | null | undefined): string =>
  formatCurrency(prix, { fallback: '—' });

export function formatPercent(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 'N/A';
  }
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatPercentRaw(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 'N/A';
  }
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(
  value: number | null | undefined,
  locale = 'fr-CA'
): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 'N/A';
  }
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDate(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return 'N/A';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };

  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat('fr-CA', defaultOptions).format(dateObj);
  } catch {
    return 'N/A';
  }
}

export const formatDateShort = (date: Date | string | number | null | undefined): string =>
  formatDate(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
