/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/mail/
 * Régénéré : functions/scripts/sync-core-mail.cjs (prebuild)
 */
/**
 * mailParser.ts — Triage courriel (Phase E-2)
 *
 * Heuristiques locales (zéro réseau) + fusion avec sortie Gemini.
 * Charte : pas d'appel @google/genai ici — uniquement parsing déterministe.
 */

import type {
  InventoryResidenceRef,
  MailContactIntent,
  MailLeadExtraction,
  MailParseResult,
  MailResidenceHint,
  MailUrgency,
} from './types';

const PHONE_CA =
  /(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g;
const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/** Téléphones nord-américains détectés dans le corps. */
export function extractPhonesCa(text: string): string[] {
  const m = text.match(PHONE_CA);
  return m ? uniq(m.map((s) => s.trim())) : [];
}

export function extractEmails(text: string): string[] {
  const m = text.match(EMAIL);
  return m ? uniq(m.map((s) => s.trim().toLowerCase())) : [];
}

function guessIntent(lower: string): MailContactIntent {
  if (/\b(oaciq|centris|matrix|noreply|no-reply)\b/i.test(lower)) return 'agency';
  if (/\b(courtier immobilier|autre courtier|collègue)\b/i.test(lower)) return 'peer';
  if (
    /\b(acheter|achat|visite|visiter|intéressé|intéressée|budget|financement)\b/i.test(
      lower
    )
  ) {
    return 'buyer';
  }
  if (/\b(vendre|vente|mandat|évaluation|acm)\b/i.test(lower)) return 'seller';
  return 'unknown';
}

function guessUrgency(lower: string): MailUrgency {
  if (/\b(urgent|urgence|immédiat|deadline|échéance|24\s*h)\b/i.test(lower))
    return 'high';
  if (/\b(important|rappel|bientôt|cette semaine)\b/i.test(lower))
    return 'medium';
  return 'low';
}

function firstLineSummary(body: string): string {
  const line = body.split(/\r?\n/).find((l) => l.trim().length > 12);
  if (!line) return body.slice(0, 140).trim();
  return line.trim().slice(0, 160);
}

/** Correspondance inventaire : sous-chaîne adresse ou ville dans le texte. */
export function matchResidenceInInventory(
  body: string,
  residences: readonly InventoryResidenceRef[]
): MailResidenceHint {
  const lower = body.toLowerCase();
  let best: MailResidenceHint = {
    matchedResidenceId: null,
    mentionedAddress: null,
    matchConfidence: 'none',
  };

  for (const r of residences) {
    const street = r.address.split(',')[0]?.trim().toLowerCase() ?? '';
    const city = r.city.trim().toLowerCase();
    if (!street) continue;

    const streetHit = street.length >= 6 && lower.includes(street);
    const cityHit = city.length >= 3 && lower.includes(city);
    const numMatch = /\b(\d{2,5})\b/.exec(street)?.[1];
    const numHit = numMatch && lower.includes(numMatch);

    if (streetHit && (cityHit || numHit)) {
      return {
        matchedResidenceId: r.id,
        mentionedAddress: `${r.address}, ${r.city}`.trim(),
        matchConfidence: 'high',
      };
    }
    if (streetHit || numHit) {
      best = {
        matchedResidenceId: r.id,
        mentionedAddress: `${r.address}, ${r.city}`.trim(),
        matchConfidence: cityHit ? 'medium' : 'low',
      };
    }
  }
  return best;
}

/** Heuristique complète (offline). */
export function parseMailBodyHeuristic(
  body: string,
  opts?: { subject?: string; sender?: string }
): MailParseResult {
  const phones = extractPhonesCa(body);
  const emails = extractEmails(body);
  const blob = `${opts?.subject ?? ''}\n${opts?.sender ?? ''}\n${body}`.toLowerCase();

  let contactName: string | null = null;
  const mJe = /\bje m['']appelle\s+([^\n,.]{2,80})/i.exec(body);
  const mNom = /\b(nom|name)\s*[:]\s*([^\n]{2,80})/i.exec(body);
  if (mJe?.[1]) contactName = mJe[1].trim();
  else if (mNom?.[2]) contactName = mNom[2].trim();

  const lead: MailLeadExtraction = {
    contactName,
    phone: phones[0] ?? null,
    email: emails[0] ?? null,
    intent: guessIntent(blob),
  };

  const residence: MailResidenceHint = {
    matchedResidenceId: null,
    mentionedAddress: null,
    matchConfidence: 'none',
  };

  return {
    lead,
    residence,
    urgency: guessUrgency(blob),
    summaryOneLine: firstLineSummary(body),
  };
}

function isIntent(x: unknown): x is MailContactIntent {
  return (
    x === 'buyer' ||
    x === 'seller' ||
    x === 'peer' ||
    x === 'agency' ||
    x === 'unknown'
  );
}

function isUrgency(x: unknown): x is MailUrgency {
  return x === 'low' || x === 'medium' || x === 'high';
}

function isConfidence(x: unknown): x is MailResidenceHint['matchConfidence'] {
  return x === 'high' || x === 'medium' || x === 'low' || x === 'none';
}

/**
 * Normalise une réponse JSON Gemini (champs partiels, types souples).
 */
export function safeNormalizeAiMailParse(raw: unknown): Partial<MailParseResult> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<MailParseResult> = {};

  if (o.lead && typeof o.lead === 'object') {
    const L = o.lead as Record<string, unknown>;
    const cn = typeof L.contactName === 'string' && L.contactName.trim() ? L.contactName.trim() : null;
    const ph = typeof L.phone === 'string' && L.phone.trim() ? L.phone.trim() : null;
    const em = typeof L.email === 'string' && L.email.trim() ? L.email.trim().toLowerCase() : null;
    out.lead = {
      contactName: cn,
      phone: ph,
      email: em,
      intent: isIntent(L.intent) ? L.intent : 'unknown',
    };
  }

  if (o.residence && typeof o.residence === 'object') {
    const R = o.residence as Record<string, unknown>;
    out.residence = {
      matchedResidenceId:
        typeof R.matchedResidenceId === 'string' && R.matchedResidenceId.trim()
          ? R.matchedResidenceId.trim()
          : null,
      mentionedAddress:
        typeof R.mentionedAddress === 'string' && R.mentionedAddress.trim()
          ? R.mentionedAddress.trim()
          : null,
      matchConfidence: isConfidence(R.matchConfidence)
        ? R.matchConfidence
        : 'none',
    };
  }

  if (isUrgency(o.urgency)) out.urgency = o.urgency;
  if (typeof o.summaryOneLine === 'string') out.summaryOneLine = o.summaryOneLine;

  return Object.keys(out).length ? out : null;
}

/** Fusion : l'IA prime quand le champ est renseigné de façon plausible. */
export function mergeMailboxParse(
  heuristic: MailParseResult,
  ai: Partial<MailParseResult> | null
): MailParseResult {
  if (!ai) return heuristic;

  const pick = (a: string | null | undefined, b: string | null) => {
    const t = a?.trim();
    return t ? t : b;
  };

  const lead: MailLeadExtraction = {
    contactName: pick(ai.lead?.contactName, heuristic.lead.contactName),
    phone: pick(ai.lead?.phone, heuristic.lead.phone),
    email: pick(ai.lead?.email, heuristic.lead.email),
    intent:
      ai.lead?.intent && ai.lead.intent !== 'unknown'
        ? ai.lead.intent
        : heuristic.lead.intent,
  };

  const residence: MailResidenceHint = {
    matchedResidenceId: pick(
      ai.residence?.matchedResidenceId ?? undefined,
      heuristic.residence.matchedResidenceId
    ),
    mentionedAddress: pick(
      ai.residence?.mentionedAddress,
      heuristic.residence.mentionedAddress
    ),
    matchConfidence:
      ai.residence?.matchConfidence && ai.residence.matchConfidence !== 'none'
        ? ai.residence.matchConfidence
        : heuristic.residence.matchConfidence,
  };

  const urgency = ai.urgency ?? heuristic.urgency;
  const summaryOneLine = ai.summaryOneLine?.trim()
    ? ai.summaryOneLine.trim()
    : heuristic.summaryOneLine;

  return { lead, residence, urgency, summaryOneLine };
}

/** Pipeline complet : heuristique + matching inventaire + fusion IA. */
export function buildMailParseResult(
  body: string,
  opts: {
    subject?: string;
    sender?: string;
    residences?: readonly InventoryResidenceRef[];
    aiPartial?: Partial<MailParseResult> | null;
  }
): MailParseResult {
  let base = parseMailBodyHeuristic(body, {
    subject: opts.subject,
    sender: opts.sender,
  });
  if (opts.residences?.length) {
    const inv = matchResidenceInInventory(body, opts.residences);
    if (inv.matchedResidenceId) {
      base = {
        ...base,
        residence: inv,
      };
    }
  }
  return mergeMailboxParse(base, opts.aiPartial ?? null);
}
