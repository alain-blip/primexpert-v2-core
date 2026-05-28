/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/mail/
 * Régénéré : functions/scripts/sync-core-mail.cjs (prebuild)
 */
/**
 * Résolution courriel ↔ contact CRM (Phase 2 messagerie).
 */

export function normalizeMailAddress(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const v = email.trim().toLowerCase();
  return v.includes('@') ? v : null;
}

export type MessagePartyEmailSource = {
  mailContactEmail?: string | null;
  fromEmailAddress?: string | null;
  direction?: 'inbound' | 'outbound';
};

export type ThreadPartyEmailSource = {
  contactEmail?: string | null;
};

/** Courriel de la partie (vendeur/acheteur) pour rattachement CRM. */
export function resolveMessagePartyEmail(message: MessagePartyEmailSource): string | null {
  return (
    normalizeMailAddress(message.mailContactEmail) ??
    normalizeMailAddress(message.fromEmailAddress)
  );
}

/** Priorité : dernier message entrant, puis fil.contactEmail. */
export function resolveThreadPartyEmail(
  thread: ThreadPartyEmailSource,
  messages: readonly MessagePartyEmailSource[]
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.direction === 'outbound') continue;
    const email = resolveMessagePartyEmail(msg);
    if (email) return email;
  }
  return normalizeMailAddress(thread.contactEmail);
}

export interface ContactEmailCandidate {
  id: string;
  email: string;
  displayName: string;
}

/** Filtre les contacts CRM par courriel exact (normalisé). */
export function findContactsByEmail<T extends ContactEmailCandidate>(
  contacts: readonly T[],
  emailRaw: unknown
): T[] {
  const email = normalizeMailAddress(emailRaw);
  if (!email) return [];
  return contacts.filter((c) => normalizeMailAddress(c.email) === email);
}

/** Chiffres uniquement (10+ pour NA). */
export function normalizePhoneDigits(phone: unknown): string | null {
  if (typeof phone !== 'string' && typeof phone !== 'number') return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

export interface ContactPhoneCandidate {
  id: string;
  displayName: string;
  phone?: string | null;
  mobile?: string | null;
}

export function contactPhoneDigits(contact: ContactPhoneCandidate): string[] {
  const out: string[] = [];
  for (const raw of [contact.phone, contact.mobile]) {
    const d = normalizePhoneDigits(raw);
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

export function findContactsByPhone<T extends ContactPhoneCandidate>(
  contacts: readonly T[],
  phoneRaw: unknown
): T[] {
  const needle = normalizePhoneDigits(phoneRaw);
  if (!needle) return [];
  return contacts.filter((c) => {
    const digits = contactPhoneDigits(c);
    return digits.some((d) => d === needle || d.endsWith(needle) || needle.endsWith(d));
  });
}
