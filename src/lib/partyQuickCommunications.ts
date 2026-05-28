import type { OrganizationContact } from '@primexpert/core/crm';
import { buildContactDisplayName } from '@primexpert/core/crm';

export const MAIL_COMPOSE_DRAFT_KEY = 'primexpert.mail.composeDraft';

/** Clé stable pour la sélection (contact + rôle sur la fiche). */
export function partySelectionKey(contactId: string, role: string): string {
  return `${contactId}::${role}`;
}

export function normalizeDialPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (raw.trim().startsWith('+')) return raw.trim();
  return digits;
}

export function contactsWithPhone(
  rows: { contact: OrganizationContact; role: string }[]
): { contact: OrganizationContact; role: string; phone: string }[] {
  return rows
    .map((row) => {
      const phone = row.contact.telephone?.trim();
      if (!phone) return null;
      return { ...row, phone: normalizeDialPhone(phone) };
    })
    .filter((r): r is { contact: OrganizationContact; role: string; phone: string } => r != null);
}

export function contactsWithEmail(
  rows: { contact: OrganizationContact; role: string }[]
): { contact: OrganizationContact; role: string; email: string }[] {
  return rows
    .map((row) => {
      const email = row.contact.email?.trim();
      if (!email) return null;
      return { ...row, email };
    })
    .filter((r): r is { contact: OrganizationContact; role: string; email: string } => r != null);
}

export function openSmsUri(phone: string): void {
  window.location.href = `sms:${phone}`;
}

export function openMailToContacts(
  rows: { contact: OrganizationContact; email: string }[],
  residenceLabel?: string
): void {
  if (rows.length === 0) return;
  const primary = rows[0]!;
  const others = rows.slice(1);
  const names = rows.map((r) => buildContactDisplayName(r.contact)).join(', ');
  const body =
    residenceLabel != null && residenceLabel.length > 0
      ? `Bonjour,\n\nConcernant : ${residenceLabel}\n\n`
      : 'Bonjour,\n\n';

  try {
    sessionStorage.setItem(
      MAIL_COMPOSE_DRAFT_KEY,
      JSON.stringify({
        body,
        toEmail: primary.email,
        at: Date.now(),
        extraRecipients: others.map((o) => o.email),
        subjectHint: residenceLabel,
      })
    );
  } catch {
    /* ignore */
  }

  const bcc = others.map((o) => encodeURIComponent(o.email)).join(',');
  const mailto =
    others.length > 0
      ? `mailto:${encodeURIComponent(primary.email)}?bcc=${bcc}&body=${encodeURIComponent(body)}`
      : `mailto:${encodeURIComponent(primary.email)}?body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
}

export function openTelFallback(phone: string): void {
  window.location.href = `tel:${phone.replace(/[^\d+*#]/g, '')}`;
}
