/**
 * Préremplissage du Rédacteur IA (navigation depuis fiche résidence, E-3).
 * SessionStorage — court terme, une consommation par ouverture d’onglet.
 */

export const CONTENT_GEN_PREFILL_KEY = 'primexpert.contentGen.prefill';

export interface ContentGenPrefillPayload {
  residenceId?: string;
  addressLine?: string;
  priceHint?: string;
  /** Bloc collé dans « Caractéristiques / contexte » pour guider Gemini. */
  briefingBlock: string;
}

export function stashContentGenPrefill(payload: ContentGenPrefillPayload): void {
  try {
    sessionStorage.setItem(CONTENT_GEN_PREFILL_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('[contentGenPrefill] stash failed', e);
  }
}

export function consumeContentGenPrefill(): ContentGenPrefillPayload | null {
  try {
    const raw = sessionStorage.getItem(CONTENT_GEN_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(CONTENT_GEN_PREFILL_KEY);
    const o = JSON.parse(raw) as ContentGenPrefillPayload;
    if (!o || typeof o.briefingBlock !== 'string' || !o.briefingBlock.trim()) return null;
    return o;
  } catch (e) {
    console.error('[contentGenPrefill] consume failed', e);
    return null;
  }
}
