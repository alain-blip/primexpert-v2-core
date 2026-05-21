/**
 * Checklist diligence raisonnable RPA — `residences/{id}.complianceChecklist`.
 */

export const COMPLIANCE_ITEM_STATUSES = [
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'NOT_APPLICABLE',
] as const;

export type ComplianceItemStatus = (typeof COMPLIANCE_ITEM_STATUSES)[number];

export interface ComplianceChecklistItemState {
  status: ComplianceItemStatus;
  verifiedAt?: string;
  notes?: string;
}

export interface ResidenceComplianceChecklist {
  items: Record<string, ComplianceChecklistItemState>;
  updatedAt?: string;
}

/** Items de base — silo RPA (diligence raisonnable). */
export const RPA_DILIGENCE_CHECKLIST_ITEMS = [
  {
    id: 'certification_ciusss',
    labelFr: 'Certification CIUSSS valide',
    labelEn: 'Valid CIUSSS certification',
  },
  {
    id: 'registre_baux',
    labelFr: 'Registre des baux à jour',
    labelEn: 'Up-to-date lease register',
  },
  {
    id: 'inspection_incendie',
    labelFr: "Rapports d'inspection incendie",
    labelEn: 'Fire inspection reports',
  },
  {
    id: 'etats_financiers_normalises',
    labelFr: 'États financiers normalisés',
    labelEn: 'Normalized financial statements',
  },
  {
    id: 'assurance_responsabilite',
    labelFr: "Preuve d'assurance responsabilité",
    labelEn: 'Liability insurance proof',
  },
] as const;

export type RpaDiligenceItemId = (typeof RPA_DILIGENCE_CHECKLIST_ITEMS)[number]['id'];

export const COMPLIANCE_STATUS_LABEL_FR: Record<ComplianceItemStatus, string> = {
  PENDING: 'En attente',
  VERIFIED: 'Vérifié',
  REJECTED: 'Refusé',
  NOT_APPLICABLE: 'Sans objet',
};

export const COMPLIANCE_STATUS_LABEL_EN: Record<ComplianceItemStatus, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  NOT_APPLICABLE: 'Not applicable',
};

function parseStatus(raw: unknown): ComplianceItemStatus {
  if (typeof raw === 'string') {
    const upper = raw.trim().toUpperCase();
    if ((COMPLIANCE_ITEM_STATUSES as readonly string[]).includes(upper)) {
      return upper as ComplianceItemStatus;
    }
  }
  return 'PENDING';
}

export function normalizeComplianceChecklist(
  doc: Record<string, unknown> | null | undefined
): ResidenceComplianceChecklist {
  const raw = doc?.complianceChecklist;
  const items: Record<string, ComplianceChecklistItemState> = {};

  for (const def of RPA_DILIGENCE_CHECKLIST_ITEMS) {
    items[def.id] = { status: 'PENDING' };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { items, updatedAt: undefined };
  }

  const block = raw as Record<string, unknown>;
  const rawItems = block.items;
  if (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) {
    for (const [key, val] of Object.entries(rawItems)) {
      if (!val || typeof val !== 'object') continue;
      const row = val as Record<string, unknown>;
      items[key] = {
        status: parseStatus(row.status),
        verifiedAt: typeof row.verifiedAt === 'string' ? row.verifiedAt : undefined,
        notes: typeof row.notes === 'string' ? row.notes : undefined,
      };
    }
  }

  return {
    items,
    updatedAt: typeof block.updatedAt === 'string' ? block.updatedAt : undefined,
  };
}

/**
 * Patch diff-based : fusionne un item sans écraser les autres champs du document.
 */
export function buildComplianceItemStatusPatch(
  doc: Record<string, unknown>,
  itemId: RpaDiligenceItemId,
  status: ComplianceItemStatus
): Record<string, unknown> {
  const current = normalizeComplianceChecklist(doc);
  const prev = current.items[itemId] ?? { status: 'PENDING' };
  const now = new Date().toISOString();

  const nextItem: ComplianceChecklistItemState = {
    status,
    verifiedAt: status === 'VERIFIED' ? now : prev.verifiedAt,
    notes: prev.notes,
  };

  return {
    complianceChecklist: {
      items: {
        ...current.items,
        [itemId]: nextItem,
      },
      updatedAt: now,
    },
  };
}

export function computeComplianceProgress(checklist: ResidenceComplianceChecklist): {
  total: number;
  verified: number;
  pending: number;
  pct: number;
} {
  const ids = RPA_DILIGENCE_CHECKLIST_ITEMS.map((i) => i.id);
  const total = ids.length;
  let verified = 0;
  let pending = 0;
  for (const id of ids) {
    const st = checklist.items[id]?.status ?? 'PENDING';
    if (st === 'VERIFIED' || st === 'NOT_APPLICABLE') verified += 1;
    if (st === 'PENDING') pending += 1;
  }
  return {
    total,
    verified,
    pending,
    pct: total > 0 ? Math.round((verified / total) * 100) : 0,
  };
}
