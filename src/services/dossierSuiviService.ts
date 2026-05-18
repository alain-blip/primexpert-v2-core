/**
 * Chargement Suivi des dossiers — Firestore → ViewModels core.
 */

import {
  computeAgencyDossierSuiviList,
  type DossierSuiviCardViewModel,
  type DossierSuiviResidenceInput,
} from '@primexpert/core/transaction';
import type { Residence } from './residences';
import type { CallAnalysisRow } from './transcriptionService';
import { fetchResidenceDocsMap } from './dashboardPriorityFollowUp';

export type { DossierSuiviCardViewModel };

function countCompteRendusForResidence(
  calls: readonly CallAnalysisRow[],
  residenceId: string
): number {
  return calls.filter(
    (c) => c.residenceId === residenceId && c.pipelineStatus === 'analyzed'
  ).length;
}

export function buildDossierSuiviInputs(
  residences: readonly Residence[],
  docs: Map<string, Record<string, unknown>>,
  brokerDisplayName: string,
  calls: readonly CallAnalysisRow[] = []
): DossierSuiviResidenceInput[] {
  return residences.map((r) => ({
    id: r.id,
    address: r.address,
    city: r.city,
    pipelineStatus: r.status,
    doc: docs.get(r.id) ?? null,
    brokerDisplayName,
    compteRendusCount: countCompteRendusForResidence(calls, r.id),
  }));
}

export function loadDossierSuiviCards(input: {
  residences: readonly Residence[];
  docs: Map<string, Record<string, unknown>>;
  brokerDisplayName: string;
  calls?: readonly CallAnalysisRow[];
  now?: number;
}): DossierSuiviCardViewModel[] {
  const rows = buildDossierSuiviInputs(
    input.residences,
    input.docs,
    input.brokerDisplayName,
    input.calls ?? []
  );
  return computeAgencyDossierSuiviList(rows, input.now);
}

export { fetchResidenceDocsMap };
