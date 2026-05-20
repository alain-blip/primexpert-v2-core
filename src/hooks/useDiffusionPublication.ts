/**
 * Hook — publication Diffusion Web (3 Callables Firebase).
 */

import { useCallback, useState } from 'react';
import {
  hideListingViaCallable,
  publishListingViaCallable,
  saveDraftListingViaCallable,
  type HideListingResult,
  type PublishListingResult,
  type SaveDraftListingResult,
} from '../services/diffusionClient';
import { useInstitutionalToast } from './useInstitutionalToast';

export function useDiffusionPublication(residenceId: string) {
  const { toast, showSuccess, showError, dismiss } = useInstitutionalToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isHiding, setIsHiding] = useState(false);

  const publish = useCallback(async (): Promise<PublishListingResult | null> => {
    if (!residenceId) return null;
    setIsPublishing(true);
    try {
      const result = await publishListingViaCallable(residenceId);
      showSuccess('Fiche publiée sur le portail web (données anonymisées).');
      return result;
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setIsPublishing(false);
    }
  }, [residenceId, showSuccess, showError]);

  const saveDraft = useCallback(async (): Promise<SaveDraftListingResult | null> => {
    if (!residenceId) return null;
    setIsSavingDraft(true);
    try {
      const result = await saveDraftListingViaCallable(residenceId);
      showSuccess('Brouillon enregistré — visible uniquement via lien privé vendeur.');
      return result;
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setIsSavingDraft(false);
    }
  }, [residenceId, showSuccess, showError]);

  const hide = useCallback(
    async (mode: 'MASQUE' | 'ARCHIVE' = 'MASQUE'): Promise<HideListingResult | null> => {
      if (!residenceId) return null;
      setIsHiding(true);
      try {
        const result = await hideListingViaCallable(residenceId, mode);
        showSuccess(
          mode === 'ARCHIVE'
            ? 'Fiche archivée et retirée du portail.'
            : 'Fiche retirée du portail (masquée).'
        );
        return result;
      } catch (err) {
        showError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setIsHiding(false);
      }
    },
    [residenceId, showSuccess, showError]
  );

  const isBusy = isPublishing || isSavingDraft || isHiding;

  return {
    toast,
    dismissToast: dismiss,
    isPublishing,
    isSavingDraft,
    isHiding,
    isBusy,
    publish,
    saveDraft,
    hide,
  };
}
