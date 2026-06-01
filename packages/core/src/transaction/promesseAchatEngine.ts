/**
 * Moteur promesse d'achat — dates limites, commissions, verrouillage WORM (6 ans).
 * Aucune dérivation mathématique côté React.
 */

import type {
  PaAccepteeCriticalDeadlineKey,
  PromesseAchatInput,
  PromesseAchatViewModel,
  PromesseCollaborator,
  PromesseCommissionInput,
  PromesseCommissionView,
  PromesseComputedDeadlines,
  PromesseDelayDays,
  PromesseOfferSummaryRow,
  PromesseStatus,
} from './types';
import { parseOffreTroncFromDoc } from './offreTronc';
import { isoFromDate, toIsoDateString, toNumber } from './transactionParseUtils';

export const PROMESSE_STATUS_OPTIONS: {
  value: PromesseStatus;
  labelFr: string;
  labelEn: string;
}[] = [
  { value: 'draft', labelFr: 'Brouillon', labelEn: 'Draft' },
  { value: 'received', labelFr: 'Reçue', labelEn: 'Received' },
  { value: 'accepted', labelFr: 'Acceptée', labelEn: 'Accepted' },
  { value: 'refused', labelFr: 'Refusée', labelEn: 'Refused' },
  { value: 'cancelled', labelFr: 'Annulée', labelEn: 'Cancelled' },
];

export const WORM_LOCK_MESSAGE_FR =
  '🔒 Document classé final - Protocole de conservation obligatoire d\'OACIQ de 6 ans activé.';

export const WORM_LOCK_MESSAGE_EN =
  '🔒 Final classified document — mandatory 6-year OACIQ retention protocol active.';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Délai légal de dédit — Loi sur le courtage immobilier (C-73.2), art. 73.2. */
export const DEDIT_LCI_ART_73_2_JOURS = 3;

/** SSOT — 7 échéances critiques dès qu'une PA passe à « acceptée » / statut Kanban `pa-acceptee`. */
export const PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS: readonly PaAccepteeCriticalDeadlineKey[] = [
  'dateLimiteReponse',
  'dateLimiteVisiteLieux',
  'dateLimiteVerificationDocuments',
  'dateLimiteInspection',
  'dateLimiteFinancement',
  'dateLimitePermis',
  'dateLimiteDeduitLci',
] as const;

function parseDelayDays(raw: unknown): PromesseDelayDays | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  return {
    visiteLieuxJours: toNumber(o.visiteLieuxJours ?? o.visiteJours),
    verificationDocumentsJours: toNumber(
      o.verificationDocumentsJours ?? o.verificationJours
    ),
    inspectionJours: toNumber(o.inspectionJours),
    financementJours: toNumber(o.financementJours ?? o.financementHypothecaireJours),
    permisJours: toNumber(o.permisJours),
  };
}

function parseCommission(raw: unknown) {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  return {
    totalePct: toNumber(o.totalePct ?? o.commissionTotalePct ?? o.totalPct),
    inscripteurPct: toNumber(o.inscripteurPct ?? o.commissionInscripteurPct),
    collaborateurPct: toNumber(o.collaborateurPct ?? o.commissionCollaborateurPct),
  };
}

function parseCollaborator(raw: unknown) {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  return {
    nom: typeof o.nom === 'string' ? o.nom : undefined,
    telephone: typeof o.telephone === 'string' ? o.telephone : undefined,
    courriel: typeof o.courriel === 'string' ? o.courriel : undefined,
    partCommissionPct: toNumber(o.partCommissionPct ?? o.partPct),
  };
}

function parseBuyer(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const fullName =
    (typeof o.fullName === 'string' && o.fullName.trim()) ||
    (typeof o.nom === 'string' && o.nom.trim()) ||
    '';
  if (!fullName) return null;
  return {
    contactId:
      typeof o.contactId === 'string'
        ? o.contactId
        : o.contactId != null
          ? String(o.contactId)
          : undefined,
    fullName,
    email:
      (typeof o.email === 'string' && o.email) ||
      (typeof o.courriel === 'string' && o.courriel) ||
      undefined,
    phone:
      (typeof o.phone === 'string' && o.phone) ||
      (typeof o.telephone === 'string' && o.telephone) ||
      undefined,
    company:
      (typeof o.company === 'string' && o.company) ||
      (typeof o.compagnie === 'string' && o.compagnie) ||
      undefined,
    internal: o.internal !== false,
  };
}

export function parsePromesseStatus(raw: unknown): PromesseStatus {
  const s = String(raw ?? 'draft').toLowerCase();
  if (s === 'received' || s === 'recue' || s === 'reçue') return 'received';
  if (s === 'accepted' || s === 'acceptee' || s === 'acceptée') return 'accepted';
  if (s === 'refused' || s === 'refusee' || s === 'refusée') return 'refused';
  if (s === 'cancelled' || s === 'annulee' || s === 'annulée') return 'cancelled';
  return 'draft';
}

export function isPromesseWormLocked(status: PromesseStatus): boolean {
  return status === 'accepted';
}

/** Date ISO + N jours calendaires. */
export function addCalendarDays(isoDate: string | undefined, days: number | undefined): string | undefined {
  if (!isoDate || days == null || !Number.isFinite(days) || days < 0) return undefined;
  const base = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(base.getTime())) return undefined;
  base.setTime(base.getTime() + Math.round(days) * MS_PER_DAY);
  return isoFromDate(base);
}

export function computeDateLimiteReponse(
  dateReception: string | undefined,
  delaiReponseJours: number | undefined
): string | undefined {
  if (!dateReception) return undefined;
  const days = delaiReponseJours ?? 0;
  return addCalendarDays(dateReception, days);
}

export function computeDeadlinesFromAcceptance(
  dateAcceptation: string | undefined,
  delais: PromesseDelayDays | undefined
): Pick<
  PromesseComputedDeadlines,
  | 'dateLimiteVisiteLieux'
  | 'dateLimiteVerificationDocuments'
  | 'dateLimiteInspection'
  | 'dateLimiteFinancement'
  | 'dateLimitePermis'
  | 'dateLimiteDeduitLci'
> {
  if (!dateAcceptation) {
    return {};
  }
  const d = delais ?? {};
  return {
    dateLimiteVisiteLieux: addCalendarDays(dateAcceptation, d.visiteLieuxJours),
    dateLimiteVerificationDocuments: addCalendarDays(
      dateAcceptation,
      d.verificationDocumentsJours
    ),
    dateLimiteInspection: addCalendarDays(dateAcceptation, d.inspectionJours),
    dateLimiteFinancement: addCalendarDays(dateAcceptation, d.financementJours),
    dateLimitePermis: addCalendarDays(dateAcceptation, d.permisJours),
    dateLimiteDeduitLci: addCalendarDays(dateAcceptation, DEDIT_LCI_ART_73_2_JOURS),
  };
}

/** Vérifie que les 7 échéances critiques sont calculables pour une PA acceptée. */
export function validatePaAccepteeCriticalDeadlines(
  input: PromesseAchatInput
): { ok: true } | { ok: false; missing: PaAccepteeCriticalDeadlineKey[] } {
  if (input.status !== 'accepted') {
    return { ok: false, missing: [...PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS] };
  }

  const vm = buildPromesseAchatViewModel(input);
  const missing = PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS.filter(
    (key) => vm.deadlines[key] == null || vm.deadlines[key] === ''
  );

  if (missing.length > 0) {
    return { ok: false, missing: [...missing] };
  }
  return { ok: true };
}

export function computeCommissionAmounts(input: {
  prixAccepte?: number;
  totalePct?: number;
  inscripteurPct?: number;
  collaborateurPct?: number;
}): PromesseCommissionView {
  const prixBase = input.prixAccepte;
  if (prixBase == null || prixBase <= 0) {
    return { prixBase };
  }
  const totalePct = input.totalePct ?? 0;
  const montantCommissionTotale = (prixBase * totalePct) / 100;
  const inscripteurPct = input.inscripteurPct ?? 0;
  const collaborateurPct = input.collaborateurPct ?? 0;
  return {
    prixBase,
    montantCommissionTotale,
    montantInscripteur: (montantCommissionTotale * inscripteurPct) / 100,
    montantCollaborateur: (montantCommissionTotale * collaborateurPct) / 100,
  };
}

export function buildPromesseAchatViewModel(input: PromesseAchatInput): PromesseAchatViewModel {
  const deadlines: PromesseComputedDeadlines = {
    dateLimiteReponse: computeDateLimiteReponse(
      input.dateReception,
      input.delaiReponseJours
    ),
    ...computeDeadlinesFromAcceptance(input.dateAcceptation, input.delais),
  };

  const commission = computeCommissionAmounts({
    prixAccepte: input.prixAccepte,
    totalePct: input.commission?.totalePct,
    inscripteurPct: input.commission?.inscripteurPct,
    collaborateurPct: input.commission?.collaborateurPct,
  });

  return {
    input,
    deadlines,
    commission,
    isWormLocked: isPromesseWormLocked(input.status),
  };
}

export function parsePromesseAchatFromDoc(
  doc: Record<string, unknown> | null | undefined
): PromesseAchatInput {
  if (!doc) return { status: 'draft' };

  const block =
    doc.promesseAchat && typeof doc.promesseAchat === 'object'
      ? (doc.promesseAchat as Record<string, unknown>)
      : doc;

  const offreTronc = parseOffreTroncFromDoc(doc);

  return {
    status: parsePromesseStatus(block.status ?? block.statutPromesse),
    prixOffert:
      offreTronc.prixOffert ??
      toNumber(block.prixOffert ?? block.prixOffre ?? block.montantOffre),
    prixAccepte: toNumber(block.prixAccepte),
    dateReception: toIsoDateString(
      block.dateReception ?? block.dateReceptionOffre
    ),
    delaiReponseJours: toNumber(block.delaiReponseJours ?? block.delaiReponse),
    dateAcceptation: toIsoDateString(block.dateAcceptation),
    dateNotairePrevue: toIsoDateString(
      block.dateNotairePrevue ?? block.dateNotaire
    ),
    delais: parseDelayDays(block.delais ?? block.delaisLimites),
    commission: parseCommission(block.commission),
    courtierCollaborateur: parseCollaborator(
      block.courtierCollaborateur ?? block.collaborateur
    ),
    buyer: parseBuyer(block.buyer ?? block.acheteur),
  };
}

/** Firestore rejette `undefined` — normaliser en `null` pour les champs imbriqués. */
function serializeDelayDays(delais?: PromesseDelayDays): Record<string, number | null> {
  const d = delais ?? {};
  return {
    visiteLieuxJours: d.visiteLieuxJours ?? null,
    verificationDocumentsJours: d.verificationDocumentsJours ?? null,
    inspectionJours: d.inspectionJours ?? null,
    financementJours: d.financementJours ?? null,
    permisJours: d.permisJours ?? null,
  };
}

function serializeCommission(
  commission?: PromesseCommissionInput
): Record<string, number | null> {
  const c = commission ?? {};
  return {
    totalePct: c.totalePct ?? null,
    inscripteurPct: c.inscripteurPct ?? null,
    collaborateurPct: c.collaborateurPct ?? null,
  };
}

function serializeCollaborator(
  courtier?: PromesseCollaborator
): Record<string, number | string | null> {
  const c = courtier ?? {};
  return {
    nom: c.nom ?? null,
    telephone: c.telephone ?? null,
    courriel: c.courriel ?? null,
    partCommissionPct: c.partCommissionPct ?? null,
  };
}

export function serializePromesseAchatForFirestore(
  input: PromesseAchatInput
): Record<string, unknown> {
  const wormLockedAt = isPromesseWormLocked(input.status)
    ? Date.now()
    : null;

  return {
    promesseAchat: {
      status: input.status,
      prixAccepte: input.prixAccepte ?? null,
      dateReception: input.dateReception ?? null,
      delaiReponseJours: input.delaiReponseJours ?? null,
      dateAcceptation: input.dateAcceptation ?? null,
      dateNotairePrevue: input.dateNotairePrevue ?? null,
      delais: serializeDelayDays(input.delais),
      commission: serializeCommission(input.commission),
      courtierCollaborateur: serializeCollaborator(input.courtierCollaborateur),
      buyer: input.buyer ?? null,
      wormLockedAt,
    },
    ...(input.status === 'accepted'
      ? { offreLoguee: true, offreEnregistree: true }
      : {}),
  };
}

export function parsePromesseOffersFromDoc(
  doc: Record<string, unknown> | null | undefined
): PromesseOfferSummaryRow[] {
  if (!doc) return [];
  const raw = doc.promesseOffers ?? doc.offresPromesse;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      return {
        id: String(o.id ?? `offer-${index}`),
        status: parsePromesseStatus(o.status),
        prixOffert: toNumber(o.prixOffert),
        prixAccepte: toNumber(o.prixAccepte),
        dateReception: toIsoDateString(o.dateReception),
        buyerName:
          typeof o.buyerName === 'string'
            ? o.buyerName
            : typeof o.acheteur === 'string'
              ? o.acheteur
              : undefined,
        savedAtMillis:
          typeof o.savedAtMillis === 'number'
            ? o.savedAtMillis
            : Date.now() - index,
      } satisfies PromesseOfferSummaryRow;
    })
    .filter((r): r is PromesseOfferSummaryRow => r != null)
    .sort((a, b) => b.savedAtMillis - a.savedAtMillis);
}

export function appendOfferSummary(
  existing: PromesseOfferSummaryRow[],
  input: PromesseAchatInput
): PromesseOfferSummaryRow[] {
  if (input.status === 'draft') return existing;
  const row: PromesseOfferSummaryRow = {
    id: `offer-${Date.now()}`,
    status: input.status,
    prixOffert: input.prixOffert,
    prixAccepte: input.prixAccepte,
    dateReception: input.dateReception,
    buyerName: input.buyer?.fullName,
    savedAtMillis: Date.now(),
  };
  return [row, ...existing].slice(0, 50);
}

export function formatIsoDateForDisplay(
  iso: string | undefined,
  locale: string
): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatCurrencyCad(amount: number | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount);
}
