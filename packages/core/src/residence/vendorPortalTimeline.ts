/**
 * Accès Vendeur — ligne du temps propriété (Règle #0 : logique dans core).
 */

import { parsePromesseAchatFromDoc } from '../transaction/promesseAchatEngine';

export type VendorTimelineStageId =
  | 'preparation_dossier'
  | 'mise_en_marche_active'
  | 'promesse_en_cours'
  | 'propriete_vendue';

export interface VendorTimelineStageDef {
  id: VendorTimelineStageId;
  labelFr: string;
  labelEn: string;
  order: number;
}

export const VENDOR_TIMELINE_STAGES: readonly VendorTimelineStageDef[] = [
  {
    id: 'preparation_dossier',
    labelFr: 'Préparation du dossier',
    labelEn: 'File preparation',
    order: 0,
  },
  {
    id: 'mise_en_marche_active',
    labelFr: 'Mise en marché active',
    labelEn: 'Active listing',
    order: 1,
  },
  {
    id: 'promesse_en_cours',
    labelFr: "Promesse d'achat en cours",
    labelEn: 'Purchase promise in progress',
    order: 2,
  },
  {
    id: 'propriete_vendue',
    labelFr: 'Propriété vendue',
    labelEn: 'Property sold',
    order: 3,
  },
] as const;

export function resolveVendorTimelineStage(
  pipelineStatus: string,
  doc: Record<string, unknown> | null | undefined
): VendorTimelineStageId {
  const status = String(pipelineStatus ?? '').trim().toLowerCase();
  if (status === 'sold') return 'propriete_vendue';

  const promesse = parsePromesseAchatFromDoc(doc);
  if (
    status === 'promise' ||
    promesse.status === 'accepted' ||
    promesse.status === 'received'
  ) {
    return 'promesse_en_cours';
  }

  if (status === 'mandate') return 'mise_en_marche_active';

  return 'preparation_dossier';
}

/** Index d'étape active (0-based) pour la ligne du temps. */
export function vendorTimelineActiveIndex(stageId: VendorTimelineStageId): number {
  return VENDOR_TIMELINE_STAGES.findIndex((s) => s.id === stageId);
}
