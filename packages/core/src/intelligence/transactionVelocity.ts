/**
 * Protocole de vélocité transactionnelle J+7 — baseline = date de libération documentaire.
 */

import { maskContactNameForSeller } from './sellerWeeklyReport';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const VELOCITY_STEP_A_MIN_DAY = 3;
export const VELOCITY_STEP_A_MAX_DAY = 4;
export const VELOCITY_STEP_B_DAY = 5;
export const VELOCITY_STEP_C_DAY = 7;

export const RELANCE_J5_TEMPLATE_FR =
  "Bonjour [Prénom], vous avez en main le dossier documentaire de la résidence depuis maintenant 5 jours. Les marques d'intérêt sur ce marché sont fortes présentement. Je communique avec vous pour valider vos questions sur les ratios financiers et fixer notre échéancier pour la suite des démarches.";

const CLARIFICATION_KEYWORDS = [
  '?',
  'question',
  'questions',
  'clarification',
  'clarifier',
  'précision',
  'precision',
  'ratio',
  'ratios',
  'financier',
  'financiers',
  'noi',
  'rne',
  'tga',
  'cap rate',
  'occupation',
  'loyer',
  'dépense',
  'depense',
  'comment',
  'pourquoi',
  'combien',
  'how',
  'what',
  'which',
];

export type VelocityPhase =
  | 'pending_baseline'
  | 'pre_a'
  | 'step_a'
  | 'step_b'
  | 'step_c'
  | 'post_offer';

export interface DocumentReleaseBaseline {
  releaseAtMillis: number | null;
  sourceField: string | null;
}

export interface VelocityMailInput {
  analyzedAtMillis: number;
  contactName: string | null;
  contactEmail: string | null;
  intent: string;
  summaryOneLine: string;
  messageId: string;
}

export interface VelocityCallInput {
  updatedAtMillis: number;
  executiveSummary?: string;
  keyPoints?: string[];
  actionItems?: string[];
  driveDocumentId: string;
}

export interface ExtractedBuyerQuestion {
  id: string;
  maskedFirstName: string;
  questionLine: string;
  sourceKind: 'mail' | 'call';
  atMillis: number;
}

export interface TransactionVelocityState {
  baseline: DocumentReleaseBaseline;
  daysSinceRelease: number | null;
  phase: VelocityPhase;
  stepAActive: boolean;
  stepBActive: boolean;
  stepCActive: boolean;
  positionRequired: boolean;
  extractedQuestions: ExtractedBuyerQuestion[];
  activeBuyer: { maskedFirstName: string; email: string | null } | null;
  offerLogged: boolean;
  relanceJ5Text: string;
}

function parseTimestampMillis(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1e12 ? raw : raw > 1e9 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (typeof o.toMillis === 'function') {
      try {
        return (o.toMillis as () => number)();
      } catch {
        return null;
      }
    }
    if (typeof o.seconds === 'number') return o.seconds * 1000;
  }
  return null;
}

/** Baseline = date de libération des documents (racine ou buyerReleaseGate). */
export function resolveDocumentReleaseBaseline(
  doc: Record<string, unknown> | null | undefined
): DocumentReleaseBaseline {
  if (!doc) return { releaseAtMillis: null, sourceField: null };

  const gate =
    doc.buyerReleaseGate && typeof doc.buyerReleaseGate === 'object'
      ? (doc.buyerReleaseGate as Record<string, unknown>)
      : null;

  const candidates: [string, unknown][] = [
    ['buyerReleaseGate.documentReleasedAt', gate?.documentReleasedAt],
    ['buyerReleaseGate.documentsReleasedAt', gate?.documentsReleasedAt],
    ['dateLiberationDocuments', doc.dateLiberationDocuments],
    ['documentsReleasedAt', doc.documentsReleasedAt],
    ['documentReleaseDate', doc.documentReleaseDate],
    ['dateEnvoiDocumentsAcheteur', doc.dateEnvoiDocumentsAcheteur],
  ];

  for (const [field, raw] of candidates) {
    const ms = parseTimestampMillis(raw);
    if (ms != null) return { releaseAtMillis: ms, sourceField: field };
  }

  return { releaseAtMillis: null, sourceField: null };
}

export function resolveOfferLogged(
  doc: Record<string, unknown> | null | undefined
): boolean {
  if (!doc) return false;
  if (
    doc.offreLoguee === true ||
    doc.offreEnregistree === true ||
    doc.buyerOfferLogged === true ||
    doc.offreAcheteurLoguee === true ||
    doc.hasLoggedOffer === true
  ) {
    return true;
  }
  const gate =
    doc.buyerReleaseGate && typeof doc.buyerReleaseGate === 'object'
      ? (doc.buyerReleaseGate as Record<string, unknown>)
      : null;
  return gate?.offerLogged === true || gate?.offreLoguee === true;
}

function daysSinceRelease(releaseAtMillis: number, now: number): number {
  return Math.floor((now - releaseAtMillis) / MS_PER_DAY);
}

function looksLikeClarification(text: string): boolean {
  const blob = text.toLowerCase();
  return CLARIFICATION_KEYWORDS.some((k) => blob.includes(k));
}

function firstNameFromMasked(masked: string, lang: 'fr' | 'en'): string {
  if (masked === 'Un contact' || masked === 'A contact') return '[Prénom]';
  return masked.split(/\s+/)[0] || '[Prénom]';
}

export function buildRelanceJ5Text(maskedFirstName: string, lang: 'fr' | 'en' = 'fr'): string {
  const prenom =
    maskedFirstName === 'Un contact' || maskedFirstName === 'A contact'
      ? '[Prénom]'
      : firstNameFromMasked(maskedFirstName, lang);
  return RELANCE_J5_TEMPLATE_FR.replace('[Prénom]', prenom);
}

export function extractBuyerQuestions(input: {
  mails: VelocityMailInput[];
  calls: VelocityCallInput[];
  windowStartMs: number;
  windowEndMs: number;
  lang: 'fr' | 'en';
}): ExtractedBuyerQuestion[] {
  const out: ExtractedBuyerQuestion[] = [];

  for (const m of input.mails) {
    if (m.analyzedAtMillis < input.windowStartMs || m.analyzedAtMillis > input.windowEndMs) {
      continue;
    }
    const isBuyer = m.intent === 'buyer';
    const blob = `${m.summaryOneLine} ${m.contactName ?? ''}`;
    if (!isBuyer && !looksLikeClarification(blob)) continue;
    if (!looksLikeClarification(blob) && !isBuyer) continue;

    const masked = maskContactNameForSeller(m.contactName, input.lang);
    out.push({
      id: `mail-${m.messageId}`,
      maskedFirstName: firstNameFromMasked(masked, input.lang),
      questionLine: m.summaryOneLine.trim(),
      sourceKind: 'mail',
      atMillis: m.analyzedAtMillis,
    });
  }

  for (const c of input.calls) {
    if (c.updatedAtMillis < input.windowStartMs || c.updatedAtMillis > input.windowEndMs) {
      continue;
    }
    const blob = [c.executiveSummary, ...(c.keyPoints ?? []), ...(c.actionItems ?? [])]
      .filter(Boolean)
      .join(' ');
    if (!looksLikeClarification(blob)) continue;
    out.push({
      id: `call-${c.driveDocumentId}`,
      maskedFirstName: input.lang === 'fr' ? 'Contact' : 'Contact',
      questionLine: (c.executiveSummary ?? blob).trim().slice(0, 280),
      sourceKind: 'call',
      atMillis: c.updatedAtMillis,
    });
  }

  return out.sort((a, b) => b.atMillis - a.atMillis);
}

function resolveActiveBuyer(
  mails: VelocityMailInput[],
  sinceMs: number,
  lang: 'fr' | 'en'
): { maskedFirstName: string; email: string | null } | null {
  const buyers = mails
    .filter(
      (m) =>
        m.analyzedAtMillis >= sinceMs &&
        (m.intent === 'buyer' || Boolean(m.contactEmail?.includes('@')))
    )
    .sort((a, b) => b.analyzedAtMillis - a.analyzedAtMillis);

  const lead = buyers.find((m) => m.intent === 'buyer') ?? buyers[0];
  if (!lead) return null;

  const masked = maskContactNameForSeller(lead.contactName, lang);
  return {
    maskedFirstName: firstNameFromMasked(masked, lang),
    email: lead.contactEmail?.trim() || null,
  };
}

export function computeTransactionVelocity(input: {
  residenceDoc: Record<string, unknown> | null | undefined;
  mails: VelocityMailInput[];
  calls: VelocityCallInput[];
  lang: 'fr' | 'en';
  now?: number;
}): TransactionVelocityState {
  const now = input.now ?? Date.now();
  const baseline = resolveDocumentReleaseBaseline(input.residenceDoc);
  const offerLogged = resolveOfferLogged(input.residenceDoc);

  if (offerLogged) {
    const buyer = baseline.releaseAtMillis
      ? resolveActiveBuyer(input.mails, baseline.releaseAtMillis, input.lang)
      : null;
    return {
      baseline,
      daysSinceRelease: baseline.releaseAtMillis
        ? daysSinceRelease(baseline.releaseAtMillis, now)
        : null,
      phase: 'post_offer',
      stepAActive: false,
      stepBActive: false,
      stepCActive: false,
      positionRequired: false,
      extractedQuestions: [],
      activeBuyer: buyer,
      offerLogged: true,
      relanceJ5Text: buildRelanceJ5Text(buyer?.maskedFirstName ?? '[Prénom]', input.lang),
    };
  }

  if (baseline.releaseAtMillis == null) {
    return {
      baseline,
      daysSinceRelease: null,
      phase: 'pending_baseline',
      stepAActive: false,
      stepBActive: false,
      stepCActive: false,
      positionRequired: false,
      extractedQuestions: [],
      activeBuyer: null,
      offerLogged: false,
      relanceJ5Text: buildRelanceJ5Text('[Prénom]', input.lang),
    };
  }

  const days = daysSinceRelease(baseline.releaseAtMillis, now);
  const releaseMs = baseline.releaseAtMillis;

  const windowAStart = releaseMs + VELOCITY_STEP_A_MIN_DAY * MS_PER_DAY;
  const windowAEnd =
    releaseMs + (VELOCITY_STEP_A_MAX_DAY + 1) * MS_PER_DAY - 1;

  const extractedQuestions = extractBuyerQuestions({
    mails: input.mails,
    calls: input.calls,
    windowStartMs: windowAStart,
    windowEndMs: windowAEnd,
    lang: input.lang,
  });

  const activeBuyer = resolveActiveBuyer(input.mails, releaseMs, input.lang);

  const stepAActive =
    days >= VELOCITY_STEP_A_MIN_DAY && days <= VELOCITY_STEP_A_MAX_DAY;
  const stepBActive = days === VELOCITY_STEP_B_DAY;
  const stepCActive = days >= VELOCITY_STEP_C_DAY;
  const positionRequired = stepCActive && !offerLogged;

  let phase: VelocityPhase = 'pre_a';
  if (stepCActive) phase = 'step_c';
  else if (stepBActive) phase = 'step_b';
  else if (stepAActive) phase = 'step_a';

  return {
    baseline,
    daysSinceRelease: days,
    phase,
    stepAActive,
    stepBActive,
    stepCActive,
    positionRequired,
    extractedQuestions,
    activeBuyer,
    offerLogged: false,
    relanceJ5Text: buildRelanceJ5Text(
      activeBuyer?.maskedFirstName ?? '[Prénom]',
      input.lang
    ),
  };
}
