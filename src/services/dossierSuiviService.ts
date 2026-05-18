/**
 * Chargement Suivi des dossiers — Firestore → ViewModels core.
 */

import {
  computeAgencyDossierSuiviList,
  type DossierSuiviCardViewModel,
  type DossierSuiviResidenceInput,
} from '@primexpert/core/transaction';
import type { Residence } from './residences';
import { fetchResidenceDocsMap } from './dashboardPriorityFollowUp';

export type { DossierSuiviCardViewModel };

export function buildDossierSuiviInputs(
  residences: readonly Residence[],
  docs: Map<string, Record<string, unknown>>,
  brokerDisplayName: string
): DossierSuiviResidenceInput[] {
  return residences.map((r) => ({
    id: r.id,
    address: r.address,
    city: r.city,
    pipelineStatus: r.status,
    doc: docs.get(r.id) ?? null,
    brokerDisplayName,
  }));
}

export function loadDossierSuiviCards(input: {
  residences: readonly Residence[];
  docs: Map<string, Record<string, unknown>>;
  brokerDisplayName: string;
  now?: number;
}): DossierSuiviCardViewModel[] {
  const rows = buildDossierSuiviInputs(
    input.residences,
    input.docs,
    input.brokerDisplayName
  );
  return computeAgencyDossierSuiviList(rows, input.now);
}

export { fetchResidenceDocsMap };
