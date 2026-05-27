/**
 * Recherche locale CRM — correspondance partielle, insensible casse/accents.
 */

import type { OrganizationContact } from './contactTypes';

function buildContactDisplayNameForSearch(contact: ContactSearchFields): string {
  const prenom = contact.prenom?.trim();
  const nom = contact.nom.trim();
  if (prenom && nom) return `${prenom} ${nom}`;
  return nom || prenom || '';
}

export interface ContactSearchFields {
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  entreprise?: string;
  firstName?: string;
  lastName?: string;
  nomComplet?: string;
  displayName?: string;
  company?: string;
  organisation?: string;
  companyName?: string;
  nomCompagnie?: string;
  societe?: string;
  buyerCriteria?: OrganizationContact['buyerCriteria'];
  sellerCriteria?: OrganizationContact['sellerCriteria'];
  brokerCriteria?: OrganizationContact['brokerCriteria'];
}

/** Normalise pour comparaison (minuscules, sans diacritiques). */
export function normalizeContactSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function pickSearchString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function collectContactCompanyNames(contact: ContactSearchFields): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string | undefined) => {
    if (!raw) return;
    const key = normalizeContactSearchText(raw);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(raw.trim());
  };

  for (const field of [
    contact.entreprise,
    contact.company,
    contact.organisation,
    contact.companyName,
    contact.nomCompagnie,
    contact.societe,
    contact.buyerCriteria?.corporateMandate?.companyName,
    contact.sellerCriteria?.corporateMandate?.companyName,
    contact.brokerCriteria?.agencyName,
  ]) {
    add(field);
  }

  return out;
}

/** Index textuel pour filtrage client (nom, entreprise, courriel, téléphone). */
export function buildContactSearchHaystack(contact: ContactSearchFields): string {
  const displayName = buildContactDisplayNameForSearch(contact);
  const parts = [
    contact.nom,
    contact.prenom,
    pickSearchString(contact.firstName),
    pickSearchString(contact.lastName),
    pickSearchString(contact.nomComplet),
    pickSearchString(contact.displayName),
    displayName,
    contact.email,
    contact.telephone,
    ...collectContactCompanyNames(contact),
  ];
  return parts
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(normalizeContactSearchText)
    .join(' ');
}

/** Correspondance partielle — texte et téléphone (chiffres). */
export function contactMatchesSearchQuery(
  contact: ContactSearchFields,
  queryRaw: string
): boolean {
  const q = normalizeContactSearchText(queryRaw);
  if (!q) return true;

  const haystack = buildContactSearchHaystack(contact);
  if (haystack.includes(q)) return true;

  const qDigits = normalizePhoneDigits(queryRaw);
  if (qDigits.length >= 3) {
    const phone = contact.telephone ? normalizePhoneDigits(contact.telephone) : '';
    if (phone.includes(qDigits)) return true;
  }

  return false;
}

export function filterContactsBySearchQuery<T extends ContactSearchFields>(
  rows: readonly T[],
  searchQuery: string
): T[] {
  const trimmed = searchQuery.trim();
  if (!trimmed) return [...rows];
  return rows.filter((c) => contactMatchesSearchQuery(c, trimmed));
}
