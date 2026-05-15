/** Ouvre la fiche 360° d’une inscription depuis le tableau de bord (E-4). */

export const LISTINGS_FOCUS_RESIDENCE_KEY = 'primexpert.listings.focusResidenceId';

export function stashListingsFocusResidenceId(residenceId: string): void {
  try {
    sessionStorage.setItem(LISTINGS_FOCUS_RESIDENCE_KEY, residenceId);
  } catch (e) {
    console.error('[listingsFocus] stash failed', e);
  }
}

export function peekListingsFocusResidenceId(): string | null {
  try {
    return sessionStorage.getItem(LISTINGS_FOCUS_RESIDENCE_KEY);
  } catch (e) {
    console.error('[listingsFocus] peek failed', e);
    return null;
  }
}

export function consumeListingsFocusResidenceId(): string | null {
  try {
    const id = sessionStorage.getItem(LISTINGS_FOCUS_RESIDENCE_KEY);
    if (!id) return null;
    sessionStorage.removeItem(LISTINGS_FOCUS_RESIDENCE_KEY);
    return id;
  } catch (e) {
    console.error('[listingsFocus] consume failed', e);
    return null;
  }
}
