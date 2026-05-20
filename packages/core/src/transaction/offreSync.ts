/**
 * Synchronisation offre ↔ promesseAchat — une seule source pour les dates dérivées des délais.
 */

import { addCalendarDays } from './promesseAchatEngine';
import type { OffreConditionsInput } from './offreConditions';
import type { PromesseDelayDays } from './types';

/** Dates limites financement / permis dérivées de l'acceptation + délais en jours. */
export function deriveOffreConditionDatesFromDelais(input: {
  dateAcceptation?: string;
  delais?: PromesseDelayDays;
}): Pick<OffreConditionsInput, 'dateLimiteFinancement' | 'dateLimitePermisMsss'> {
  const d = input.delais ?? {};
  return {
    dateLimiteFinancement: addCalendarDays(
      input.dateAcceptation,
      d.financementJours
    ),
    dateLimitePermisMsss: addCalendarDays(input.dateAcceptation, d.permisJours),
  };
}

/** Fusionne conditions explicites + dates dérivées (les délais priment si calculables). */
export function mergeOffreConditionsWithDelais(
  conditions: OffreConditionsInput,
  input: { dateAcceptation?: string; delais?: PromesseDelayDays }
): OffreConditionsInput {
  const derived = deriveOffreConditionDatesFromDelais(input);
  return {
    ...conditions,
    ...(derived.dateLimiteFinancement != null
      ? { dateLimiteFinancement: derived.dateLimiteFinancement }
      : {}),
    ...(derived.dateLimitePermisMsss != null
      ? { dateLimitePermisMsss: derived.dateLimitePermisMsss }
      : {}),
  };
}
