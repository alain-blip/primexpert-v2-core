/**
 * Tarification des loyers — grille + fail-safe RBE.
 */

import type { RentPricingRowView, RentPricingView } from './types';
import { resolveIdentityField } from './resolveIdentityField';
import { shouldShowRaphaelForField } from './msssRaphaelBadge';
import { hasMsssEnrichment } from './msssRaphaelBadge';

export interface RentPricingRowDef {
  typeKey: string;
  labelFr: string;
  labelEn: string;
  qtyCanonicalKey: string;
}

export const RENT_PRICING_ROW_DEFS: RentPricingRowDef[] = [
  { typeKey: 'studios', labelFr: 'Studios', labelEn: 'Studios', qtyCanonicalKey: 'nombreStudios' },
  {
    typeKey: 'chambresSimples',
    labelFr: 'Chambres simples',
    labelEn: 'Single rooms',
    qtyCanonicalKey: 'nombreChambresSimples',
  },
  {
    typeKey: 'chambresDoubles',
    labelFr: 'Chambres doubles',
    labelEn: 'Double rooms',
    qtyCanonicalKey: 'nombreChambresDoubles',
  },
  { typeKey: 'deuxDemie', labelFr: '2½', labelEn: '2½', qtyCanonicalKey: 'nombre2demie' },
  { typeKey: 'troisDemie', labelFr: '3½', labelEn: '3½', qtyCanonicalKey: 'nombre3demie' },
  { typeKey: 'quatreDemie', labelFr: '4½', labelEn: '4½', qtyCanonicalKey: 'nombre4demie' },
  {
    typeKey: 'unitesSoins',
    labelFr: 'Unités soins',
    labelEn: 'Care units',
    qtyCanonicalKey: 'nombreUnitesSoins',
  },
];

export function rentFieldId(typeKey: string, col: 'qty' | 'occupation' | 'loyer'): string {
  return `rent-${typeKey}-${col}`;
}

export function parseRentFieldId(
  fieldId: string
): { typeKey: string; col: 'qty' | 'occupation' | 'loyer' } | null {
  const m = /^rent-(.+)-(qty|occupation|loyer)$/.exec(fieldId);
  if (!m) return null;
  return { typeKey: m[1], col: m[2] as 'qty' | 'occupation' | 'loyer' };
}

type TarifRow = {
  qty?: number;
  occupationPct?: number;
  loyerMoyen?: number;
};

function getTarificationRoot(doc: Record<string, unknown>): Record<string, TarifRow> {
  const raw = doc.tarificationLoyers;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const rows = (raw as Record<string, unknown>).rows;
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) return {};
  return rows as Record<string, TarifRow>;
}

function parseCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n =
    typeof value === 'string'
      ? parseFloat(value.replace(/[^\d.-]/g, ''))
      : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function computeRowAnnualRevenue(
  qty: number,
  occupationPct: number | null,
  loyerMoyen: number | null
): number | null {
  if (qty <= 0 || loyerMoyen == null || loyerMoyen <= 0) return null;
  const occ = occupationPct != null ? Math.min(100, Math.max(0, occupationPct)) / 100 : 1;
  return Math.round(qty * occ * loyerMoyen * 12);
}

export function buildRentPricingView(doc: Record<string, unknown>): RentPricingView {
  const tarif = getTarificationRoot(doc);
  const rows: RentPricingRowView[] = RENT_PRICING_ROW_DEFS.map((def) => {
    const stored = tarif[def.typeKey] ?? {};
    const qty =
      parseCount(stored.qty) ||
      parseCount(resolveIdentityField(doc, def.qtyCanonicalKey));
    const occupationPct = parseMoney(stored.occupationPct);
    const loyerMoyen = parseMoney(stored.loyerMoyen);
    const revenuPotentielAnnuel = computeRowAnnualRevenue(qty, occupationPct, loyerMoyen);

    const fieldIds = {
      qty: rentFieldId(def.typeKey, 'qty'),
      occupation: rentFieldId(def.typeKey, 'occupation'),
      loyer: rentFieldId(def.typeKey, 'loyer'),
    };

    return {
      typeKey: def.typeKey,
      labelFr: def.labelFr,
      labelEn: def.labelEn,
      qty,
      occupationPct,
      loyerMoyen,
      revenuPotentielAnnuel,
      fieldIds,
      showRaphaelBadge:
        hasMsssEnrichment(doc) &&
        shouldShowRaphaelForField(doc, fieldIds.qty, {
          value: qty,
          confirmedBy:
            doc.tarificationLoyers &&
            typeof doc.tarificationLoyers === 'object' &&
            !Array.isArray(doc.tarificationLoyers)
              ? (doc.tarificationLoyers as Record<string, unknown>).confirmedBy
              : undefined,
          forceEmpty: qty === 0,
        }),
    };
  });

  let totalRevenuPotentielAnnuel = 0;
  let hasTotal = false;
  for (const row of rows) {
    if (row.revenuPotentielAnnuel != null && row.revenuPotentielAnnuel > 0) {
      totalRevenuPotentielAnnuel += row.revenuPotentielAnnuel;
      hasTotal = true;
    }
  }

  const failSafeRbeHint = hasTotal ? totalRevenuPotentielAnnuel : null;

  return {
    rows,
    totalRevenuPotentielAnnuel: hasTotal ? totalRevenuPotentielAnnuel : null,
    failSafeRbeHint,
  };
}

/** Fail-safe : dérive les revenus annuels si RBE / revenusAnnuels manquent en finance. */
export function deriveRevenusAnnuelsFromTarification(
  doc: Record<string, unknown> | null | undefined
): number | null {
  if (!doc) return null;
  return buildRentPricingView(doc).failSafeRbeHint;
}

export function buildRentPricingSavePatch(
  doc: Record<string, unknown>,
  fieldId: string,
  rawValue: string
): Record<string, unknown> {
  const parsed = parseRentFieldId(fieldId);
  if (!parsed) {
    throw new Error(`Champ tarification inconnu: ${fieldId}`);
  }

  const def = RENT_PRICING_ROW_DEFS.find((r) => r.typeKey === parsed.typeKey);
  if (!def) throw new Error(`Type de unité inconnu: ${parsed.typeKey}`);

  const trimmed = rawValue.trim();
  let num: number | null = null;
  if (trimmed) {
    const n = parseFloat(trimmed.replace(/[^\d.-]/g, ''));
    num = Number.isFinite(n) ? n : null;
  }

  const tarifRoot =
    doc.tarificationLoyers && typeof doc.tarificationLoyers === 'object'
      ? { ...(doc.tarificationLoyers as Record<string, unknown>) }
      : {};
  const rows =
    tarifRoot.rows && typeof tarifRoot.rows === 'object' && !Array.isArray(tarifRoot.rows)
      ? { ...(tarifRoot.rows as Record<string, TarifRow>) }
      : {};
  const row = { ...(rows[parsed.typeKey] ?? {}) };

  if (parsed.col === 'qty') row.qty = num != null ? Math.max(0, Math.round(num)) : 0;
  if (parsed.col === 'occupation') row.occupationPct = num;
  if (parsed.col === 'loyer') row.loyerMoyen = num;

  rows[parsed.typeKey] = row;

  const patch: Record<string, unknown> = {
    tarificationLoyers: {
      ...tarifRoot,
      rows,
    },
  };

  if (parsed.col === 'qty' && row.qty != null) {
    patch[def.qtyCanonicalKey] = row.qty;
  }

  if (hasMsssEnrichment(doc)) {
    const confirmations = doc.identityConfirmations;
    const map =
      confirmations && typeof confirmations === 'object' && !Array.isArray(confirmations)
        ? { ...(confirmations as Record<string, unknown>) }
        : {};
    map[fieldId] = { confirmedBy: 'user', confirmedAt: new Date().toISOString() };
    patch.identityConfirmations = map;
    (patch.tarificationLoyers as Record<string, unknown>).confirmedBy = 'user';
  }

  return patch;
}

export function isRentPricingFieldId(fieldId: string): boolean {
  return parseRentFieldId(fieldId) != null;
}
