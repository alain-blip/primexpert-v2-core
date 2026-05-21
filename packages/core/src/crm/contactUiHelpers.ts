/**
 * Helpers affichage / filtrage CRM — zéro logique métier lourde côté React.
 */

import {
  CONTACT_RELATION_ROLES,
  deriveBuyerTier,
  type BuyerCommercialTier,
  type BuyerQualificationStatus,
  type ContactAssetNiche,
  type ContactLciFieldKey,
  type ContactRelationRole,
  type ContactSilo,
  type OrganizationContact,
} from './contactTypes';

export { CONTACT_RELATION_ROLES };

export type ContactListFilter =
  | 'mine'
  | 'pool_rpa'
  | 'silo_residentiel'
  | 'silo_commercial';

export const CONTACT_LIST_FILTERS: readonly ContactListFilter[] = [
  'mine',
  'pool_rpa',
  'silo_residentiel',
  'silo_commercial',
] as const;

export const CONTACT_SILO_LABEL_FR: Record<ContactSilo, string> = {
  RESIDENTIEL: 'Résidentiel (plex ≤ 5)',
  RES_COM: 'Résidentiel et commercial',
  COMMERCIAL_SPEC: 'Commercial spécialisé',
};

export const CONTACT_SILO_LABEL_EN: Record<ContactSilo, string> = {
  RESIDENTIEL: 'Residential (plex ≤ 5)',
  RES_COM: 'Residential & commercial',
  COMMERCIAL_SPEC: 'Specialized commercial',
};

export const CONTACT_ROLE_LABEL_FR: Record<ContactRelationRole, string> = {
  buyer: 'Acheteur',
  seller: 'Vendeur',
  professional: 'Professionnel',
  broker: 'Courtier',
  former_owner: 'Ancien propriétaire',
  blacklist: 'Liste noire',
};

export const CONTACT_ROLE_LABEL_EN: Record<ContactRelationRole, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  professional: 'Professional',
  broker: 'Broker',
  former_owner: 'Former owner',
  blacklist: 'Block list',
};

export const BUYER_QUALIFICATION_LABEL_FR: Record<BuyerQualificationStatus, string> = {
  PENDING_NDA: 'En attente — entente de confidentialité (NDA)',
  NDA_SIGNED: 'Entente de confidentialité signée',
  FUNDS_VERIFIED: 'Preuve de fonds vérifiée',
  QUALIFIED: 'Acheteur qualifié',
};

export const BUYER_TIER_LABEL_FR: Record<BuyerCommercialTier, string> = {
  PRIVILEGED: 'Acheteur privilégié',
  CONFIDENTIAL: 'Acheteur confidentiel',
};

export const BUYER_TIER_LABEL_EN: Record<BuyerCommercialTier, string> = {
  PRIVILEGED: 'Privileged buyer',
  CONFIDENTIAL: 'Confidential buyer',
};

export const BUYER_TIER_FILTER_OPTIONS: readonly BuyerCommercialTier[] = [
  'PRIVILEGED',
  'CONFIDENTIAL',
] as const;

export const BUYER_QUALIFICATION_LABEL_EN: Record<BuyerQualificationStatus, string> = {
  PENDING_NDA: 'Pending — non-disclosure agreement (NDA)',
  NDA_SIGNED: 'Non-disclosure agreement signed',
  FUNDS_VERIFIED: 'Proof of funds verified',
  QUALIFIED: 'Qualified buyer',
};

export const CONTACT_LCI_FIELD_LABEL_FR: Record<ContactLciFieldKey, string> = {
  nom: 'Nom',
  adresse: 'Adresse',
  dateNaissance: 'Date de naissance',
  occupationProfession: 'Occupation (métier)',
};

export function contactListFilterLabelFr(filter: ContactListFilter): string {
  switch (filter) {
    case 'mine':
      return 'Mes contacts';
    case 'pool_rpa':
      return 'Pool résidence pour aînés (RPA) — agence';
    case 'silo_residentiel':
      return 'Silo résidentiel';
    case 'silo_commercial':
      return 'Silo commercial';
    default:
      return filter;
  }
}

export function contactListFilterLabelEn(filter: ContactListFilter): string {
  switch (filter) {
    case 'mine':
      return 'My contacts';
    case 'pool_rpa':
      return 'Retirement home (RPA) pool — agency';
    case 'silo_residentiel':
      return 'Residential silo';
    case 'silo_commercial':
      return 'Commercial silo';
    default:
      return filter;
  }
}

export function buildContactDisplayName(contact: OrganizationContact): string {
  const prenom = contact.prenom?.trim();
  const nom = contact.nom.trim();
  if (prenom && nom) return `${prenom} ${nom}`;
  return nom || prenom || '—';
}

export function contactInitials(contact: OrganizationContact): string {
  const name = buildContactDisplayName(contact);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Chaîne de recherche normalisée (nom, prénom, courriel, téléphone). */
export function buildContactSearchHaystack(contact: OrganizationContact): string {
  return [
    contact.nom,
    contact.prenom,
    contact.email,
    contact.telephone,
    buildContactDisplayName(contact),
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

/** Filtre texte client — insensible à la casse, sans requête Firestore. */
export function filterContactsBySearchQuery(
  rows: OrganizationContact[],
  searchQuery: string
): OrganizationContact[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((c) => buildContactSearchHaystack(c).includes(q));
}

/** Filtre par rôle relationnel (`relationRoles[]`). */
export function filterContactsByRelationRole(
  rows: OrganizationContact[],
  selectedRole: ContactRelationRole | null | undefined
): OrganizationContact[] {
  if (!selectedRole) return rows;
  return rows.filter((c) => c.relationRoles?.includes(selectedRole));
}

/** Filtre par typologie acheteur commerciale dérivée (`deriveBuyerTier`). */
export function filterContactsByBuyerTier(
  rows: OrganizationContact[],
  selectedBuyerTier: BuyerCommercialTier | null | undefined
): OrganizationContact[] {
  if (!selectedBuyerTier) return rows;
  return rows.filter((c) => deriveBuyerTier(c) === selectedBuyerTier);
}

export function formatBuyerTierLabel(
  tier: BuyerCommercialTier,
  language: 'fr' | 'en'
): string {
  return language === 'fr' ? BUYER_TIER_LABEL_FR[tier] : BUYER_TIER_LABEL_EN[tier];
}

/**
 * Filtres client empilés : silo/pool → recherche → rôle → typologie acheteur.
 * À appeler sur le tableau déjà chargé en mémoire.
 */
export function applyContactListClientFilters(
  rows: OrganizationContact[],
  options: {
    listFilter: ContactListFilter;
    currentUid: string;
    searchQuery?: string;
    selectedRole?: ContactRelationRole | null;
    selectedBuyerTier?: BuyerCommercialTier | null;
  }
): OrganizationContact[] {
  let out = applyContactListFilter(rows, options.listFilter, options.currentUid);
  out = filterContactsBySearchQuery(out, options.searchQuery ?? '');
  out = filterContactsByRelationRole(out, options.selectedRole ?? null);
  out = filterContactsByBuyerTier(out, options.selectedBuyerTier ?? null);
  return out;
}

/** Filtre liste contacts (après chargement Firestore). */
export function applyContactListFilter(
  rows: OrganizationContact[],
  filter: ContactListFilter,
  currentUid: string
): OrganizationContact[] {
  switch (filter) {
    case 'mine':
      return rows.filter((c) => c.ownerId === currentUid);
    case 'pool_rpa':
      return rows.filter(
        (c) =>
          c.visibility === 'AGENCY_SHARED' &&
          c.silo === 'COMMERCIAL_SPEC' &&
          c.assetNiche === 'RPA'
      );
    case 'silo_residentiel':
      return rows.filter((c) => c.silo === 'RESIDENTIEL');
    case 'silo_commercial':
      return rows.filter(
        (c) => c.silo === 'COMMERCIAL_SPEC' || c.silo === 'RES_COM'
      );
    default:
      return rows;
  }
}

export function formatContactRoles(
  roles: ContactRelationRole[] | undefined,
  language: 'fr' | 'en'
): string {
  if (!roles?.length) return '—';
  const map = language === 'fr' ? CONTACT_ROLE_LABEL_FR : CONTACT_ROLE_LABEL_EN;
  return roles.map((r) => map[r] ?? r).join(', ');
}

export function formatContactSiloBadge(
  silo: ContactSilo,
  assetNiche: ContactAssetNiche | undefined,
  language: 'fr' | 'en'
): string {
  const base = language === 'fr' ? CONTACT_SILO_LABEL_FR[silo] : CONTACT_SILO_LABEL_EN[silo];
  if (silo === 'COMMERCIAL_SPEC' && assetNiche) {
    return `${base} · ${assetNiche}`;
  }
  return base;
}
