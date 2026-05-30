/**
 * Valeurs par défaut du panneau d'assemblage — suggestion ACM V3.2 (RNE ÷ TGA ajusté).
 */

import type { BuildPaActifsRenderDataInput } from './paActifsTypes';
import { buildPaActifsRenderData } from './buildPaActifsRenderData';
import type { ContractAssemblerFieldState } from './annexeFieldSchema';
import { createDefaultContractAssemblerState } from './annexeFieldSchema';

export interface BuildContractAssemblerDefaultsInput extends BuildPaActifsRenderDataInput {
  /** Surcharge explicite du prix annexe (sinon valeur marchande indicative ACM). */
  suggestedAnnexePrix?: number;
}

/**
 * Initialise l'état UI avec le nouveau prix suggéré par la formule ACM lorsque disponible.
 */
export function buildContractAssemblerDefaults(
  input: BuildContractAssemblerDefaultsInput
): ContractAssemblerFieldState {
  const paData = buildPaActifsRenderData(input);
  const suggested =
    input.suggestedAnnexePrix ??
    paData.financial.valeurMarchandeIndicative ??
    paData.financial.prixTotal ??
    undefined;

  return createDefaultContractAssemblerState({
    values: {
      'annexePrix.nouveauPrix':
        suggested != null && Number.isFinite(suggested) ? Math.round(suggested) : undefined,
    },
  });
}

export { buildPaActifsRenderData };
