/**
 * Contacts internes (répertoire plateforme) — liaison promesse / CRM.
 */

export interface InternalContact {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  company?: string;
  type: string;
}

export const INTERNAL_CONTACTS: InternalContact[] = [
  {
    id: '1',
    fullName: 'Jean Tremblay',
    email: 'jean@tremblay.com',
    phone: '514-555-0101',
    type: 'Vendeur',
  },
  {
    id: '2',
    fullName: 'Sophie Martin',
    email: 'sophie.m@gmail.com',
    phone: '438-555-0202',
    type: 'Acheteur',
  },
  {
    id: '3',
    fullName: 'Marc-André Roy',
    email: 'roy@immobilier.ca',
    phone: '450-555-0303',
    company: 'Immobilier Roy Inc.',
    type: 'Collaborateur',
  },
  {
    id: '4',
    fullName: 'Lucie Gagnon',
    email: 'lg@videotron.ca',
    phone: '514-555-0404',
    type: 'Vendeur',
  },
  {
    id: '5',
    fullName: 'Pierre Lefebvre',
    email: 'pierre.le@outlook.com',
    phone: '514-555-0505',
    type: 'Acheteur',
  },
];

export function searchInternalContacts(query: string): InternalContact[] {
  const q = query.trim().toLowerCase();
  if (!q) return INTERNAL_CONTACTS;
  return INTERNAL_CONTACTS.filter(
    (c) =>
      c.fullName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      (c.company?.toLowerCase().includes(q) ?? false)
  );
}
