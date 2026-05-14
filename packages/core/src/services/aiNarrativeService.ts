/**
 * aiNarrativeService.ts — Stub Phase D-1 (Silos 2026)
 *
 * En V1, ce service appelle une Cloud Function du projet
 * `copilote-pour-courtiers-en-rpa`. Mais V2 vit dans `primexpert-app`,
 * projet Firebase étanche (cf. RAPPORT_PHASE_C §I.1).
 *
 * Donc en V2, on retourne `null` pour forcer le fallback déterministe sur
 * `generateFallbackNarrative()` (templates RULES OACIQ).
 *
 * L'enrichissement IA est reporté à la Phase E (quand on aura tranché
 * la stratégie Firebase inter-projets — cf. RAPPORT_PHASE_C §V).
 *
 * Charte v2026.2 §II — Interdiction de Recréer : on NE duplique PAS la
 * Cloud Function V1 ici. On déclare juste "pas d'IA disponible" et le
 * selector fait le bon choix.
 */

import type {
  SellerNarrativeDecision,
  NarrativeFeatureVector,
} from '../narrative/types';

/**
 * Stub V2 — retourne `null` pour forcer le fallback templates déterministes.
 *
 * Signature alignée sur le contrat attendu par `selectSellerNarrative.ts`
 * (V1) : `generateAINarrative(featureVector, timeoutMs?)`.
 *
 * @returns null (toujours, en Phase D)
 */
export async function generateAINarrative(
  _featureVector: NarrativeFeatureVector,
  _timeoutMs?: number
): Promise<SellerNarrativeDecision | null> {
  return null;
}
