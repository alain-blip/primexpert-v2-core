/**
 * Mapping extraction IA → grille financial/dataV2 + segmentation Big Data.
 * Logique pure (SSOT locale documents ; pas de calcul CFO ici).
 */

import { findRegion } from '@primexpert/core/financial';
import type { ExpenseKey } from '@primexpert/core/financial';
import { EXPENSE_KEYS } from '@primexpert/core/financial';
import type { AssetNiche } from '../types/residence';
import type {
  MarketDataProvenance,
  MarketSiloType,
} from '../types/marketAnalytics';
import type { PropertyDocumentExtractedData } from '../types/propertyDocument';

export const MARKET_SILO_OPTIONS: ReadonlyArray<{
  id: MarketSiloType;
  labelFr: string;
  labelEn: string;
}> = [
  { id: 'rpa_ri_chsld', labelFr: 'RPA / RI / CHSLD', labelEn: 'Senior living / LTC' },
  { id: 'plex_multi', labelFr: 'Plex multi-logements', labelEn: 'Multi-plex' },
  { id: 'cpe', labelFr: 'CPE (garde)', labelEn: 'Childcare (CPE)' },
  { id: 'condo_unifamilial', labelFr: 'Condo / unifamilial', labelEn: 'Condo / single-family' },
  { id: 'fonds_de_commerce', labelFr: 'Fonds de commerce', labelEn: 'Business sale' },
] as const;

export interface ExtractedAmountRow {
  id: string;
  label: string;
  value: number;
  currency: string;
  expenseKey: ExpenseKey | null;
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

/** Heuristique libellé → clé dépense Copilote / dataV2. */
export function mapLabelToExpenseKey(label: string): ExpenseKey | null {
  const n = normalizeLabel(label);
  if (!n) return null;

  if (/taxe(s)?\s*(municip|scol)|municipal|school tax/.test(n)) {
    return 'taxesMunicipalesScolaire';
  }
  if (/taxe(s)?\s*et\s*permis|permis/.test(n)) return 'taxesPermis';
  if (/assurance/.test(n)) return 'assurances';
  if (/energie|electric|gaz|chauffage|mazout/.test(n)) return 'energie';
  if (/telecom|cabl|telephon/.test(n)) return 'telecommunications';
  if (/entretien|reparation|maintenance/.test(n)) return 'entretienReparation';
  if (/gestion|management/.test(n)) return 'fraisGestion';
  if (/honoraire|professionnel|comptab/.test(n)) return 'honorairesProfessionnels';
  if (/publicite|marketing/.test(n)) return 'publicite';
  if (/salaire|main d oeuvre|main-d'oeuvre|payroll/.test(n)) return 'salairesAvantages';
  if (/nourriture|food/.test(n)) return 'nourritures';
  if (/divers|misc/.test(n)) return 'divers';

  return null;
}

export function assetNicheToDefaultSilo(niche?: AssetNiche): MarketSiloType {
  switch (niche) {
    case 'PLEX':
      return 'plex_multi';
    case 'CPE':
      return 'cpe';
    case 'RPA':
    default:
      return 'rpa_ri_chsld';
  }
}

export function inferProvenanceFromFileName(fileName: string): MarketDataProvenance {
  const n = normalizeLabel(fileName);
  if (/evaluation|evaluat|rapport d evaluation|appraisal|jlr/.test(n)) {
    return 'rapport_evaluation';
  }
  return 'etats_financiers';
}

export function resolveRegionAdministrative(city?: string, regionHint?: string): {
  code: string;
  displayName: string;
  regionAdministrative: string;
} {
  const row = findRegion(regionHint || city || '');
  if (row) {
    return {
      code: row.code,
      displayName: row.name,
      regionAdministrative: `${row.code.padStart(2, '0')}-${row.name}`,
    };
  }
  return {
    code: '00',
    displayName: 'Non classée',
    regionAdministrative: '00-Non classée',
  };
}

export function flattenExtractedAmounts(
  data: PropertyDocumentExtractedData
): ExtractedAmountRow[] {
  const rows: ExtractedAmountRow[] = [];
  let i = 0;

  const push = (label: string, value: unknown, currency = 'CAD') => {
    const num =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? parseFloat(value.replace(/[^\d.-]/g, ''))
          : NaN;
    if (!label || Number.isNaN(num)) return;
    const expenseKey = mapLabelToExpenseKey(label);
    rows.push({
      id: `amt-${i++}`,
      label: label.trim(),
      value: num,
      currency,
      expenseKey:
        expenseKey && (EXPENSE_KEYS as readonly string[]).includes(expenseKey) ? expenseKey : null,
    });
  };

  for (const a of data.amounts ?? []) {
    push(a.label, a.value, a.currency ?? 'CAD');
  }
  for (const t of data.taxes ?? []) {
    const label = t.label || `Taxes ${t.year ?? ''}`.trim();
    push(label, t.amount ?? 0);
  }
  for (const r of data.revenus ?? []) {
    push(r.label, r.value);
  }
  for (const d of data.depenses ?? []) {
    push(d.label, d.value);
  }

  return rows;
}

export function inferAnneeDonnees(
  data: PropertyDocumentExtractedData,
  fileName: string
): number {
  if (typeof data.annee === 'number' && data.annee > 1990 && data.annee < 2100) {
    return data.annee;
  }
  for (const d of data.dates ?? []) {
    const y = parseInt(d.isoDate?.slice(0, 4) ?? '', 10);
    if (y > 1990 && y < 2100) return y;
  }
  const m = fileName.match(/20\d{2}/);
  if (m) return parseInt(m[0], 10);
  return new Date().getFullYear();
}

export function formatExtractedCurrency(value: number, locale: 'fr' | 'en'): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(value);
}
