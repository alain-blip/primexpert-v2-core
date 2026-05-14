import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Date longue — Québec (fuseau America/Toronto).
 * UTF-8 côté app : les chaînes accentuées transitent en Unicode (Firestore inclus).
 */
export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('fr-CA', {
    dateStyle: 'long',
    timeZone: 'America/Toronto',
  }).format(new Date(date));
}

export type FormatCurrencyOptions = {
  /** Décimales max (0 pour prix d’affiche entiers, 2 pour NOI, etc.) */
  maxDecimals?: number;
};

/**
 * Montant en dollars canadiens, format québécois (ex. « 650 000 $ » ou « 12,50 $ »).
 * Utilise fr-CA + devise CAD (symbole en suffixe, espaces de groupement).
 */
export function formatCurrency(amount: number, opts?: FormatCurrencyOptions) {
  const max = opts?.maxDecimals ?? 0;
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  }).format(amount);
}

/**
 * Montant entier sans symbole de devise — pour champs libres combinés à un libellé « Prix ».
 * Ex. 650000 → « 650 000 » (séparateurs fins insécables).
 */
export function formatMontantEntierCad(amount: number): string {
  return new Intl.NumberFormat('fr-CA', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })
    .format(Math.round(amount))
    .replace(/\s/g, '\u202f');
}
