/**
 * Parties & intervenants liés à une fiche résidence (`residences/{id}.partiesImpliquees`).
 */

export const RESIDENCE_PARTY_ROLES = [
  'VENDEUR',
  'ACHETEUR',
  'NOTAIRE',
  'COLLABORATEUR',
] as const;

export type ResidencePartyRole = (typeof RESIDENCE_PARTY_ROLES)[number];

export interface PartieImpliquee {
  contactId: string;
  role: ResidencePartyRole;
  /** ISO 8601 (assignation au dossier). */
  assigneLe: string;
}

export const RESIDENCE_PARTY_ROLE_LABEL_FR: Record<ResidencePartyRole, string> = {
  VENDEUR: 'Vendeur',
  ACHETEUR: 'Acheteur',
  NOTAIRE: 'Notaire',
  COLLABORATEUR: 'Collaborateur',
};

export const RESIDENCE_PARTY_ROLE_LABEL_EN: Record<ResidencePartyRole, string> = {
  VENDEUR: 'Seller',
  ACHETEUR: 'Buyer',
  NOTAIRE: 'Notary',
  COLLABORATEUR: 'Collaborator',
};

function parseAssigneLe(raw: unknown): string {
  if (raw == null) return new Date().toISOString();
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    const d = (raw as { toDate: () => Date }).toDate();
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof raw === 'number') return new Date(raw).toISOString();
  return new Date().toISOString();
}

function parseRole(raw: unknown): ResidencePartyRole | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return (RESIDENCE_PARTY_ROLES as readonly string[]).includes(upper)
    ? (upper as ResidencePartyRole)
    : null;
}

/** Lit le tableau `partiesImpliquees` depuis le document résidence. */
export function parsePartiesImpliquees(doc: Record<string, unknown> | null | undefined): PartieImpliquee[] {
  const raw = doc?.partiesImpliquees;
  if (!Array.isArray(raw)) return [];
  const out: PartieImpliquee[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const contactId = typeof r.contactId === 'string' ? r.contactId.trim() : '';
    const role = parseRole(r.role);
    if (!contactId || !role) continue;
    out.push({
      contactId,
      role,
      assigneLe: parseAssigneLe(r.assigneLe),
    });
  }
  return out;
}

/** Contact vendeur (VENDEUR) lié à la fiche — pour Accès Vendeur. */
export function resolveSellerContactId(
  doc: Record<string, unknown> | null | undefined
): string | null {
  const seller = parsePartiesImpliquees(doc).find((p) => p.role === 'VENDEUR');
  return seller?.contactId ?? null;
}

/** Patch Firestore complet (diff-based : remplace le tableau en une écriture cohérente). */
export function buildPartiesImpliqueesPatch(
  parties: PartieImpliquee[]
): Record<string, unknown> {
  return { partiesImpliquees: parties };
}

export function buildAddPartiePatch(
  doc: Record<string, unknown>,
  input: { contactId: string; role: ResidencePartyRole }
): Record<string, unknown> {
  const current = parsePartiesImpliquees(doc);
  if (current.some((p) => p.contactId === input.contactId)) {
    return buildPartiesImpliqueesPatch(
      current.map((p) =>
        p.contactId === input.contactId
          ? { ...p, role: input.role, assigneLe: new Date().toISOString() }
          : p
      )
    );
  }
  return buildPartiesImpliqueesPatch([
    ...current,
    {
      contactId: input.contactId,
      role: input.role,
      assigneLe: new Date().toISOString(),
    },
  ]);
}

export function buildRemovePartiePatch(
  doc: Record<string, unknown>,
  contactId: string
): Record<string, unknown> {
  const current = parsePartiesImpliquees(doc);
  return buildPartiesImpliqueesPatch(current.filter((p) => p.contactId !== contactId));
}

/** Ajoute un ID résidence au cache dérivé `contact.residenceIds` (SSOT bidirectionnel). */
export function syncAddResidenceIdToContact(
  residenceIds: readonly string[] | undefined,
  residenceId: string
): string[] {
  const id = residenceId.trim();
  if (!id) return [...(residenceIds ?? [])];
  const set = new Set(residenceIds ?? []);
  set.add(id);
  return Array.from(set);
}

/** Retire un ID résidence du cache dérivé `contact.residenceIds`. */
export function syncRemoveResidenceIdFromContact(
  residenceIds: readonly string[] | undefined,
  residenceId: string
): string[] {
  const id = residenceId.trim();
  if (!id) return [...(residenceIds ?? [])];
  return (residenceIds ?? []).filter((r) => r !== id);
}
