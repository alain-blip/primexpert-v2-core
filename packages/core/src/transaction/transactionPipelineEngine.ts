/**
 * Suivi des dossiers — progression active (dossiers chauds, suggestions IA).
 * Règle #0 : aucun calcul métier dans les composants React.
 */

import { parseVisitorVisitRegistry } from '../market/visitorRegistry';
import {
  hoursUntilPaDeadline,
  isFinancementConditionCompleted,
  isInspectionConditionCompleted,
  isWithinPaAlertWindow,
  paDeadlineLabelFr,
  resolveCollaboratorDisplayName,
} from '../intelligence/dashboardPriorityFollowUp';
import { resolveDocumentReleaseBaseline } from '../intelligence/transactionVelocity';
import { resolveListingDocumentReleaseGate } from '../intelligence/sellerUpdatePrerequisites';
import {
  buildPromesseAchatViewModel,
  parsePromesseAchatFromDoc,
} from './promesseAchatEngine';

export type DossierSuiviStatutAffiche =
  | 'mandat_mise_en_marche'
  | 'documents_partages'
  | 'promesse_acceptee';

export const DOSSIER_STATUT_LABEL_FR: Record<DossierSuiviStatutAffiche, string> = {
  mandat_mise_en_marche: 'Mandat en cours (Mise en marché)',
  documents_partages: 'Documents partagés',
  promesse_acceptee: "Promesse d'achat acceptée",
};

export type PreapprobationEtat = 'validee' | 'en_attente' | 'non_recue';

export interface DossierProgressionMetrics {
  visitesCount: number;
  compteRendusCount: number;
  preapprobation: PreapprobationEtat;
}

export interface DossierSuiviResidenceInput {
  id: string;
  address: string;
  city: string;
  /** Statut pipeline Firestore (prospect | mandate | promise | sold | …). */
  pipelineStatus: string;
  doc: Record<string, unknown> | null | undefined;
  brokerDisplayName: string;
  /** Comptes-rendus d’appels (sous-collection `call_analyses`), agrégés côté service. */
  compteRendusCount?: number;
}

export interface DossierSuiviCardViewModel {
  residenceId: string;
  propertyName: string;
  brokerDisplayName: string;
  statut: DossierSuiviStatutAffiche;
  statutLabel: string;
  progressionText: string;
  prochaineEtape: string;
  suggestionIA: string;
  sortPriority: number;
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

/** Exclut les dossiers vendus et hors progression active. */
export function resolveDossierSuiviStatut(
  pipelineStatus: string,
  doc: Record<string, unknown> | null | undefined
): DossierSuiviStatutAffiche | null {
  if (pipelineStatus === 'sold') return null;

  const promesse = parsePromesseAchatFromDoc(doc);
  if (promesse.status === 'accepted') return 'promesse_acceptee';

  const baseline = resolveDocumentReleaseBaseline(doc);
  if (baseline.releaseAtMillis != null) return 'documents_partages';

  if (pipelineStatus === 'mandate') return 'mandat_mise_en_marche';

  return null;
}

export function resolveVisitesCount(
  doc: Record<string, unknown> | null | undefined
): number {
  return parseVisitorVisitRegistry(doc ?? null).length;
}

export function resolveCompteRendusCount(
  doc: Record<string, unknown> | null | undefined,
  overrideCount?: number
): number {
  if (typeof overrideCount === 'number' && overrideCount >= 0) return overrideCount;
  if (!doc) return 0;
  if (typeof doc.nombreComptesRendus === 'number' && doc.nombreComptesRendus >= 0) {
    return doc.nombreComptesRendus;
  }
  const arrays = [doc.comptesRendusVisite, doc.rapportsVisite, doc.comptesRendus];
  for (const raw of arrays) {
    if (Array.isArray(raw)) return raw.length;
  }
  return 0;
}

export function resolvePreapprobationEtat(
  doc: Record<string, unknown> | null | undefined
): PreapprobationEtat {
  if (!doc) return 'non_recue';
  const gate = resolveListingDocumentReleaseGate(doc);
  if (gate.proofOfDepositValidated) return 'validee';

  const truthy = (v: unknown) => v === true;
  if (
    truthy(doc.preapprobationValidee) ||
    truthy(doc.lettrePreapprobationRecue) ||
    truthy(doc.preuveMiseDeFondsValidee) ||
    truthy(doc.preuveMiseDeFonds) ||
    truthy(doc.buyerPreapprovalValidated)
  ) {
    return 'validee';
  }
  if (
    truthy(doc.preapprobationEnCours) ||
    truthy(doc.preapprobationEnAttente) ||
    truthy(doc.buyerPreapprovalPending)
  ) {
    return 'en_attente';
  }
  return 'non_recue';
}

export function resolveDossierProgressionMetrics(
  doc: Record<string, unknown> | null | undefined,
  compteRendusCount?: number
): DossierProgressionMetrics {
  return {
    visitesCount: resolveVisitesCount(doc),
    compteRendusCount: resolveCompteRendusCount(doc, compteRendusCount),
    preapprobation: resolvePreapprobationEtat(doc),
  };
}

function preapprobationLabelFr(etat: PreapprobationEtat): string {
  switch (etat) {
    case 'validee':
      return 'Préapprobation validée';
    case 'en_attente':
      return 'Préapprobation en attente';
    case 'non_recue':
      return 'Préapprobation non reçue';
  }
}

export function buildProgressionText(
  metrics: DossierProgressionMetrics
): string {
  const v = metrics.visitesCount;
  const visites = `${v} visite${v > 1 ? 's' : ''} faite${v > 1 ? 's' : ''}`;
  const cr = metrics.compteRendusCount;
  const comptes = `${cr} compte${cr > 1 ? 's' : ''}-rendu${cr > 1 ? 's' : ''}`;
  return `${visites} | ${comptes} | ${preapprobationLabelFr(metrics.preapprobation)}`;
}

function nearestPaDeadlineInAlertWindow(
  doc: Record<string, unknown> | null | undefined,
  now: number
): { kind: 'inspection' | 'financement'; iso: string } | null {
  const promesse = parsePromesseAchatFromDoc(doc);
  const vm = buildPromesseAchatViewModel(promesse);

  const candidates: { kind: 'inspection' | 'financement'; iso: string }[] = [];
  const inspectionIso = vm.deadlines.dateLimiteInspection;
  if (
    inspectionIso &&
    !isInspectionConditionCompleted(doc) &&
    isWithinPaAlertWindow(inspectionIso, now)
  ) {
    candidates.push({ kind: 'inspection', iso: inspectionIso });
  }
  const financementIso = vm.deadlines.dateLimiteFinancement;
  if (
    financementIso &&
    !isFinancementConditionCompleted(doc) &&
    isWithinPaAlertWindow(financementIso, now)
  ) {
    candidates.push({ kind: 'financement', iso: financementIso });
  }

  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) => hoursUntilPaDeadline(a.iso, now) - hoursUntilPaDeadline(b.iso, now)
  );
  return candidates[0];
}

export function buildProchaineEtape(
  statut: DossierSuiviStatutAffiche,
  doc: Record<string, unknown> | null | undefined,
  metrics: DossierProgressionMetrics,
  now: number
): string {
  switch (statut) {
    case 'mandat_mise_en_marche':
      if (metrics.visitesCount === 0) {
        return 'Planifier une première visite sur place';
      }
      if (metrics.compteRendusCount < metrics.visitesCount) {
        return 'Rédiger le compte-rendu de la dernière visite';
      }
      return 'Poursuivre la mise en marché et documenter l’achalandage';

    case 'documents_partages':
      if (metrics.preapprobation !== 'validee') {
        return 'Obtenir la lettre de préapprobation bancaire';
      }
      return 'Valider les questions de l’acheteur sur le dossier documentaire';

    case 'promesse_acceptee': {
      const promesse = parsePromesseAchatFromDoc(doc);
      const vm = buildPromesseAchatViewModel(promesse);
      const pending: { kind: 'inspection' | 'financement'; iso: string; hours: number }[] = [];

      const inspectionIso = vm.deadlines.dateLimiteInspection;
      if (inspectionIso && !isInspectionConditionCompleted(doc)) {
        pending.push({
          kind: 'inspection',
          iso: inspectionIso,
          hours: hoursUntilPaDeadline(inspectionIso, now),
        });
      }
      const financementIso = vm.deadlines.dateLimiteFinancement;
      if (financementIso && !isFinancementConditionCompleted(doc)) {
        pending.push({
          kind: 'financement',
          iso: financementIso,
          hours: hoursUntilPaDeadline(financementIso, now),
        });
      }

      if (pending.length === 0) {
        return 'Confirmer l’avancement de toutes les conditions de la promesse';
      }
      pending.sort((a, b) => a.hours - b.hours);
      const next = pending[0];
      const label = paDeadlineLabelFr(next.kind);
      if (next.hours <= 0) {
        return `Confirmer l’état du délai ${label} (échéance atteinte)`;
      }
      if (next.hours <= 48) {
        return `Obtenir une mise à jour sur le délai ${label} (échéance imminente)`;
      }
      return `Planifier le suivi du délai ${label}`;
    }
  }
}

export function buildSuggestionIA(
  statut: DossierSuiviStatutAffiche,
  doc: Record<string, unknown> | null | undefined,
  metrics: DossierProgressionMetrics,
  now: number
): string {
  if (statut === 'documents_partages') {
    const gate = resolveListingDocumentReleaseGate(doc);
    if (!gate.proofOfDepositValidated) {
      return "💡 L'acheteur a ouvert les documents mais n'a pas fourni sa preuve de mise de fonds. Relancer.";
    }
    if (metrics.visitesCount === 0) {
      return '💡 Planifier une visite ou consigner l’achalandage au registre visiteurs.';
    }
    return '💡 Confirmer la réception du dossier et recenser les questions de l’acheteur.';
  }

  if (statut === 'promesse_acceptee') {
    const alert = nearestPaDeadlineInAlertWindow(doc, now);
    if (alert) {
      const label = paDeadlineLabelFr(alert.kind);
      const promesse = parsePromesseAchatFromDoc(doc);
      const collab = resolveCollaboratorDisplayName(promesse.courtierCollaborateur);
      if (collab) {
        return `💡 Relancer le courtier collaborateur ${collab} — échéance du délai ${label} dans 48 h.`;
      }
      return `💡 Relancer l'acheteur — échéance du délai ${label} dans 48 h.`;
    }
    return '💡 Suivre l’avancement des conditions de la promesse d’achat.';
  }

  if (metrics.visitesCount === 0) {
    return '💡 Enregistrer les visites et les comptes-rendus pour alimenter la traction du dossier.';
  }
  if (metrics.compteRendusCount === 0) {
    return '💡 Documenter le compte-rendu de la dernière visite pour le registre du dossier.';
  }
  return '💡 Maintenir la cadence de visites et de comptes-rendus jusqu’au partage documentaire.';
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
    return Number.isFinite(minHours) ? minHours : 2000;
  }
  if (statut === 'documents_partages') {
    const baseline = resolveDocumentReleaseBaseline(doc);
    if (baseline.releaseAtMillis == null) return 4000;
    const days = Math.floor((now - baseline.releaseAtMillis) / (24 * 60 * 60 * 1000));
    return 3000 - days;
  }
  return 5000;
}

export function buildDossierSuiviCardViewModel(
  input: DossierSuiviResidenceInput,
  now = Date.now()
): DossierSuiviCardViewModel | null {
  const statut = resolveDossierSuiviStatut(input.pipelineStatus, input.doc);
  if (!statut) return null;

  const metrics = resolveDossierProgressionMetrics(input.doc, input.compteRendusCount);
  const propertyName = resolvePropertyName(input.doc, input.address, input.city);

  return {
    residenceId: input.id,
    propertyName,
    brokerDisplayName: input.brokerDisplayName.trim() || 'Courtier responsable',
    statut,
    statutLabel: DOSSIER_STATUT_LABEL_FR[statut],
    progressionText: buildProgressionText(metrics),
    prochaineEtape: buildProchaineEtape(statut, input.doc, metrics, now),
    suggestionIA: buildSuggestionIA(statut, input.doc, metrics, now),
    sortPriority: computeSortPriority(statut, input.doc, now),
  };
}

export function computeAgencyDossierSuiviList(
  residences: readonly DossierSuiviResidenceInput[],
  now = Date.now()
): DossierSuiviCardViewModel[] {
  const cards: DossierSuiviCardViewModel[] = [];
  for (const r of residences) {
    if (r.pipelineStatus === 'sold') continue;
    const card = buildDossierSuiviCardViewModel(r, now);
    if (card) cards.push(card);
  }
  return cards.sort((a, b) => {
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    return a.propertyName.localeCompare(b.propertyName, 'fr-CA');
  });
}
