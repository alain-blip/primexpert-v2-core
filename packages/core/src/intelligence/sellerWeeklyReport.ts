/**
 * Rapport vendeur hebdomadaire — règles de fer (sécurité, anonymisation, lexique QC).
 */

import type { MailContactIntent } from '../mail/types';
import { resolveVendeurEmailStrict } from './sellerUpdatePrerequisites';

export const SELLER_REPORT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const NDA_GUARDRAIL_FR =
  "Sachez qu'en conformité avec nos protocoles de sécurité, aucun document ou fiche technique ne sera transféré à cet acquéreur tant que son entente de confidentialité (NDA) signée et sa preuve de mise de fonds n'auront pas été reçues et validées au dossier.";

export const NDA_GUARDRAIL_EN =
  'Please note that, in line with our security protocols, no document or technical package will be shared with this buyer until their signed confidentiality agreement (NDA) and proof of deposit have been received and validated in the file.';

const CORPORATE_PATTERN =
  /\b(inc\.?|ltée|ltee|lté|corp\.?|groupe|société|societe|s\.e\.n\.c|senc|llc|ltd\.?|co\.?|cie)\b/i;

const BUYER_DOC_KEYWORDS = [
  'état financier',
  'etats financiers',
  'états financiers',
  'financial statement',
  'plan',
  'plans',
  'document',
  'documents',
  'fiche technique',
  'dossier',
  'nda',
  'entente de confidentialité',
  'confidentialité',
  'mise de fonds',
  'preuve de fonds',
  'proof of funds',
  'deposit',
  'information memorandum',
  'offre d\'achat',
  'offre indicative',
  'visite',
  'tour',
  'brochure',
  'cahier',
  'revenus',
  'bilan',
  't4',
  'taxes',
];

const EUROPEAN_LEXICON: [RegExp, string][] = [
  [/structure architecturale de la propriété/gi, "l'état de la bâtisse"],
  [/structure architecturale/gi, "l'état de la bâtisse"],
  [/audit(s)?\b/gi, 'vérification'],
  [/due diligence/gi, 'diligence commerciale'],
  [/property structure/gi, 'le bâtiment'],
];

export interface WeeklyCallSnapshot {
  updatedAtMillis: number;
  fileName: string;
  executiveSummary?: string;
  keyPoints?: string[];
  actionItems?: string[];
  commitments?: string[];
}

export interface WeeklyMailSnapshot {
  analyzedAtMillis: number;
  contactName: string | null;
  intent: MailContactIntent;
  summaryOneLine: string;
  urgency: string;
}

export interface BuyerInterestSignals {
  detected: boolean;
  reasons: string[];
}

export function filterLast7Days<T extends { sortMs: number }>(
  items: T[],
  now = Date.now()
): T[] {
  const cutoff = now - SELLER_REPORT_WINDOW_MS;
  return items.filter((i) => i.sortMs >= cutoff);
}

function textBlob(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function detectBuyerDocumentInterest(input: {
  mails: WeeklyMailSnapshot[];
  calls: WeeklyCallSnapshot[];
}): BuyerInterestSignals {
  const reasons: string[] = [];

  for (const m of input.mails) {
    if (m.intent === 'buyer') {
      reasons.push('Courriel identifié comme acquéreur');
    }
    const blob = textBlob(m.summaryOneLine, m.contactName ?? '');
    if (BUYER_DOC_KEYWORDS.some((k) => blob.includes(k))) {
      reasons.push('Demande documentaire détectée (courriel)');
    }
  }

  for (const c of input.calls) {
    const blob = textBlob(
      c.executiveSummary,
      ...(c.keyPoints ?? []),
      ...(c.actionItems ?? [])
    );
    if (BUYER_DOC_KEYWORDS.some((k) => blob.includes(k))) {
      reasons.push('Demande documentaire détectée (appel)');
    }
  }

  return { detected: reasons.length > 0, reasons: [...new Set(reasons)] };
}

/** Masquage vendeur : prénom seul ou initiale corporation — jamais le nom de famille complet. */
export function maskContactNameForSeller(
  fullName: string | null | undefined,
  lang: 'fr' | 'en' = 'fr'
): string {
  if (!fullName?.trim()) {
    return lang === 'fr' ? 'Un contact' : 'A contact';
  }
  const n = fullName.trim();
  if (n.includes('@')) return lang === 'fr' ? 'Un contact' : 'A contact';

  if (CORPORATE_PATTERN.test(n)) {
    const words = n.replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean);
    const lead = words[0] ?? 'Groupe';
    const secondInitial = words[1]?.[0];
    return secondInitial ? `${lead} ${secondInitial}.` : `${lead}.`;
  }

  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return parts[0];
}

export function purgeEuropeanLexicon(text: string): string {
  let out = text;
  for (const [pattern, replacement] of EUROPEAN_LEXICON) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

const DOCUMENT_SHARING_PATTERNS: RegExp[] = [
  /nous (vous )?enverrons? (les |des )?documents/gi,
  /transfert (des |de )?documents/gi,
  /partage (des |de )?(documents|fiches? techniques?)/gi,
  /accès aux (états financiers|plans|documents)/gi,
  /vous recevrez (la|les) (fiche|documents?)/gi,
  /we (will )?send (the )?documents/gi,
  /sharing (the )?documents/gi,
];

/** Retire les formulations de partage documentaire non autorisées. */
export function stripUnauthorizedDocumentSharing(text: string): string {
  let out = text;
  for (const pattern of DOCUMENT_SHARING_PATTERNS) {
    out = out.replace(pattern, (match) => {
      const fr = '[Partage documentaire suspendu — conformité du dossier en cours]';
      const en = '[Document sharing on hold — file compliance in progress]';
      return match.length > 20 ? fr : fr;
    });
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function ensureNdaGuardrail(
  report: string,
  mustInclude: boolean,
  lang: 'fr' | 'en'
): string {
  if (!mustInclude) return report;
  const guard = lang === 'fr' ? NDA_GUARDRAIL_FR : NDA_GUARDRAIL_EN;
  const normalized = report.toLowerCase();
  if (
    normalized.includes('nda') &&
    normalized.includes('mise de fonds')
  ) {
    return report;
  }
  return `${report.trim()}\n\n${guard}`;
}

export function postProcessSellerReport(
  raw: string,
  opts: {
    buyerInterest: boolean;
    documentReleaseAllowed: boolean;
    lang: 'fr' | 'en';
  }
): string {
  let cleaned = purgeEuropeanLexicon(raw.trim());

  const mustBlockDocumentSharing =
    opts.buyerInterest && !opts.documentReleaseAllowed;

  if (mustBlockDocumentSharing) {
    cleaned = stripUnauthorizedDocumentSharing(cleaned);
    cleaned = ensureNdaGuardrail(cleaned, true, opts.lang);
  }

  return cleaned;
}

export function buildWeeklyChronologyBlock(input: {
  calls: WeeklyCallSnapshot[];
  mails: WeeklyMailSnapshot[];
  lang: 'fr' | 'en';
  locale: string;
}): string {
  const lines: string[] = [];
  const items: { sortMs: number; line: string }[] = [];

  for (const c of input.calls) {
    const when = new Date(c.updatedAtMillis).toLocaleString(input.locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const summary = c.executiveSummary?.trim() || (input.lang === 'fr' ? '(pas de résumé)' : '(no summary)');
    items.push({
      sortMs: c.updatedAtMillis,
      line: `[${when}] ${input.lang === 'fr' ? 'Appel' : 'Call'} — ${c.fileName}\n${summary}`,
    });
  }

  for (const m of input.mails) {
    const when = new Date(m.analyzedAtMillis).toLocaleString(input.locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const masked = maskContactNameForSeller(m.contactName, input.lang);
    items.push({
      sortMs: m.analyzedAtMillis,
      line: `[${when}] ${input.lang === 'fr' ? 'Courriel' : 'Email'} — ${masked} (${m.intent})\n${m.summaryOneLine}`,
    });
  }

  items.sort((a, b) => b.sortMs - a.sortMs);
  for (const item of items) {
    lines.push(item.line);
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** @deprecated Utiliser resolveVendeurEmailStrict — routage production vendeurEmail uniquement. */
export function resolveVendorEmailFromDoc(
  doc: Record<string, unknown> | null | undefined
): string | null {
  return resolveVendeurEmailStrict(doc);
}
