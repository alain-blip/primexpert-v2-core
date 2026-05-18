/**
 * Suivi des dossiers — agrégation macro agence (lexique Québec, KISS 3 lignes).
 * Règle #0 : aucun calcul métier dans les composants React.
 */

import { normalizeDeclarationVendeur } from '../declaration/normalizeDeclaration';
import {
  isDeclarationLockedStatus,
  isDeclarationUploadedStatus,
} from '../declaration/types';
import {
  hoursUntilPaDeadline,
  isFinancementConditionCompleted,
  isInspectionConditionCompleted,
  paDeadlineLabelFr,
} from '../intelligence/dashboardPriorityFollowUp';
import { resolveDocumentReleaseBaseline } from '../intelligence/transactionVelocity';
import { resolveListingDocumentReleaseGate } from '../intelligence/sellerUpdatePrerequisites';
import {
  buildPromesseAchatViewModel,
  isPromesseWormLocked,
  parsePromesseAchatFromDoc,
} from './promesseAchatEngine';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DossierSuiviStatutAffiche =
  | 'documents_partages'
  | 'promesse_acceptee'
  | 'vendu';

export const DOSSIER_STATUT_LABEL_FR: Record<DossierSuiviStatutAffiche, string> = {
  documents_partages: 'Documents partagés',
  promesse_acceptee: "Promesse d'achat acceptée",
  vendu: 'Vendu',
};

export const DOSSIER_WORM_LOCK_LINE_FR =
  '[🔒 Dossier verrouillé immuable — Conservation légale d’OACIQ active (6 ans)]';

export interface DossierSuiviResidenceInput {
  id: string;
  address: string;
  city: string;
  /** Statut pipeline Firestore (prospect | mandate | promise | sold | …). */
  pipelineStatus: string;
  doc: Record<string, unknown> | null | undefined;
  brokerDisplayName: string;
}

export interface DossierSuiviCardViewModel {
  residenceId: string;
  propertyName: string;
  brokerDisplayName: string;
  statut: DossierSuiviStatutAffiche;
  statutLabel: string;
  /** Ligne 2 — texte « Suivi : … » (sans préfixe). */
  suiviTexte: string;
  /** Ligne 3 — vérifications ou message WORM. */
  ligne3Texte: string;
  ligne3IsWormLock: boolean;
  /** Tri : échéances les plus proches en premier. */
  sortPriority: number;
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

function resolvePropertyName(
  doc: Record<string, unknown> | null | undefined,
  address: string,
  city: string
): string {
  if (typeof doc?.name === 'string' && doc.name.trim()) return doc.name.trim();
  if (city?.trim()) return `${address}, ${city}`;
  return address;
}

export function resolveDossierSuiviStatut(
  pipelineStatus: string,
  doc: Record<string, unknown> | null | undefined
): DossierSuiviStatutAffiche | null {
  if (pipelineStatus === 'sold') return 'vendu';

  const promesse = parsePromesseAchatFromDoc(doc);
  if (promesse.status === 'accepted') return 'promesse_acceptee';

  const baseline = resolveDocumentReleaseBaseline(doc);
  if (baseline.releaseAtMillis != null) return 'documents_partages';

  return null;
}

function daysSinceRelease(releaseAtMillis: number, now: number): number {
  return Math.max(0, Math.floor((now - releaseAtMillis) / MS_PER_DAY));
}

export function buildDocumentsPartagesSuiviTexte(
  releaseAtMillis: number,
  now: number
): string {
  const days = daysSinceRelease(releaseAtMillis, now);
  const j = days <= 0 ? 1 : days;
  return `Partagé depuis ${days} jour${days > 1 ? 's' : ''} (J+${j})`;
}

function formatPaDelaiCountdown(
  kind: 'inspection' | 'financement',
  isoDeadline: string,
  now: number
): string {
  const label = paDeadlineLabelFr(kind);
  const hours = hoursUntilPaDeadline(isoDeadline, now);
  if (hours <= 0) {
    return `Échéance du délai ${label} atteinte — suivi requis`;
  }
  if (hours <= 48) {
    const h = Math.max(1, Math.round(hours));
    return `Échéance du délai ${label} dans ${h}h`;
  }
  const days = Math.ceil(hours / 24);
  return `Échéance du délai ${label} dans ${days} jour${days > 1 ? 's' : ''}`;
}

export function buildPromesseAccepteeSuiviTexte(
  doc: Record<string, unknown> | null | undefined,
  now: number
): string {
  const promesse = parsePromesseAchatFromDoc(doc);
  const vm = buildPromesseAchatViewModel(promesse);
  const candidates: { kind: 'inspection' | 'financement'; iso: string; hours: number }[] = [];

  const inspectionIso = vm.deadlines.dateLimiteInspection;
  if (inspectionIso && !isInspectionConditionCompleted(doc)) {
    candidates.push({
      kind: 'inspection',
      iso: inspectionIso,
      hours: hoursUntilPaDeadline(inspectionIso, now),
    });
  }

  const financementIso = vm.deadlines.dateLimiteFinancement;
  if (financementIso && !isFinancementConditionCompleted(doc)) {
    candidates.push({
      kind: 'financement',
      iso: financementIso,
      hours: hoursUntilPaDeadline(financementIso, now),
    });
  }

  if (candidates.length === 0) {
    return 'Promesse d’achat acceptée — suivi des conditions en cours';
  }

  candidates.sort((a, b) => a.hours - b.hours);
  const next = candidates[0];
  return formatPaDelaiCountdown(next.kind, next.iso, now);
}

function formatIsoDateFr(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function resolveDateClotureNotaireIso(
  doc: Record<string, unknown> | null | undefined
): string | null {
  if (!doc) return null;
  const promesse = parsePromesseAchatFromDoc(doc);
  const block =
    doc.promesseAchat && typeof doc.promesseAchat === 'object'
      ? (doc.promesseAchat as Record<string, unknown>)
      : doc;

  const candidates: unknown[] = [
    promesse.dateNotairePrevue,
    block.dateNotairePrevue,
    block.dateNotaire,
    doc.dateSignatureChezNotaire,
    doc.dateClotureNotaire,
    doc.dateVenteNotaire,
    doc.dateTransactionNotaire,
    doc.soldAt,
    doc.dateVente,
  ];

  for (const raw of candidates) {
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
      return raw.trim().slice(0, 10);
    }
    const ms = parseTimestampMillis(raw);
    if (ms != null) {
      const d = new Date(ms);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return null;
}

export function buildVenduSuiviTexte(
  doc: Record<string, unknown> | null | undefined
): string {
  const iso = resolveDateClotureNotaireIso(doc);
  if (iso) {
    return `Signature chez le notaire prévue le ${formatIsoDateFr(iso)}`;
  }
  return 'Signature chez le notaire — date à confirmer';
}

export function resolveDossierVerifications(
  doc: Record<string, unknown> | null | undefined
): {
  ndaSigne: boolean;
  capaciteFinanciereValidee: boolean;
  declarationVendeurCertifiee: boolean;
} {
  const gate = resolveListingDocumentReleaseGate(doc);
  const declaration = normalizeDeclarationVendeur(doc);
  const declarationOk =
    isDeclarationLockedStatus(declaration.status) ||
    isDeclarationUploadedStatus(declaration.status) ||
    Boolean(declaration.certifiedAt?.trim());

  return {
    ndaSigne: gate.ndaSignedValidated,
    capaciteFinanciereValidee: gate.proofOfDepositValidated,
    declarationVendeurCertifiee: declarationOk,
  };
}

function verificationSegment(label: string, done: boolean): string {
  return `[${done ? '✓' : ' '}] ${label}`;
}

export function buildVerificationsLigneTexte(
  doc: Record<string, unknown> | null | undefined
): { texte: string; isWormLock: boolean } {
  const promesse = parsePromesseAchatFromDoc(doc);
  if (promesse.status === 'accepted' && isPromesseWormLocked(promesse.status)) {
    return { texte: DOSSIER_WORM_LOCK_LINE_FR, isWormLock: true };
  }

  const v = resolveDossierVerifications(doc);
  const texte = [
    verificationSegment('NDA signé', v.ndaSigne),
    verificationSegment('Capacité financière validée', v.capaciteFinanciereValidee),
    verificationSegment('Déclaration du vendeur certifiée', v.declarationVendeurCertifiee),
  ].join(' | ');

  return { texte, isWormLock: false };
}

function computeSortPriority(
  statut: DossierSuiviStatutAffiche,
  doc: Record<string, unknown> | null | undefined,
  now: number
): number {
  if (statut === 'promesse_acceptee') {
    const promesse = parsePromesseAchatFromDoc(doc);
    const vm = buildPromesseAchatViewModel(promesse);
    let minHours = Number.POSITIVE_INFINITY;
    for (const iso of [
      vm.deadlines.dateLimiteInspection,
      vm.deadlines.dateLimiteFinancement,
    ]) {
      if (!iso) continue;
      const h = hoursUntilPaDeadline(iso, now);
      if (h < minHours) minHours = h;
    }
    return Number.isFinite(minHours) ? minHours : 9999;
  }
  if (statut === 'documents_partages') {
    const baseline = resolveDocumentReleaseBaseline(doc);
    if (baseline.releaseAtMillis == null) return 5000;
    return 3000 - daysSinceRelease(baseline.releaseAtMillis, now);
  }
  return 10000;
}

export function buildDossierSuiviCardViewModel(
  input: DossierSuiviResidenceInput,
  now = Date.now()
): DossierSuiviCardViewModel | null {
  const statut = resolveDossierSuiviStatut(input.pipelineStatus, input.doc);
  if (!statut) return null;

  const propertyName = resolvePropertyName(input.doc, input.address, input.city);
  let suiviTexte: string;

  switch (statut) {
    case 'documents_partages': {
      const baseline = resolveDocumentReleaseBaseline(input.doc);
      if (baseline.releaseAtMillis == null) return null;
      suiviTexte = buildDocumentsPartagesSuiviTexte(baseline.releaseAtMillis, now);
      break;
    }
    case 'promesse_acceptee':
      suiviTexte = buildPromesseAccepteeSuiviTexte(input.doc, now);
      break;
    case 'vendu':
      suiviTexte = buildVenduSuiviTexte(input.doc);
      break;
  }

  const ligne3 = buildVerificationsLigneTexte(input.doc);

  return {
    residenceId: input.id,
    propertyName,
    brokerDisplayName: input.brokerDisplayName.trim() || 'Courtier responsable',
    statut,
    statutLabel: DOSSIER_STATUT_LABEL_FR[statut],
    suiviTexte,
    ligne3Texte: ligne3.texte,
    ligne3IsWormLock: ligne3.isWormLock,
    sortPriority: computeSortPriority(statut, input.doc, now),
  };
}

export function computeAgencyDossierSuiviList(
  residences: readonly DossierSuiviResidenceInput[],
  now = Date.now()
): DossierSuiviCardViewModel[] {
  const cards: DossierSuiviCardViewModel[] = [];
  for (const r of residences) {
    const card = buildDossierSuiviCardViewModel(r, now);
    if (card) cards.push(card);
  }
  return cards.sort((a, b) => {
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    return a.propertyName.localeCompare(b.propertyName, 'fr-CA');
  });
}
