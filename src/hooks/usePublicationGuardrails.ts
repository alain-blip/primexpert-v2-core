import { useMemo } from 'react';
import {
  PUBLIC_LISTING_STATUS,
  buildPublicListing,
  evaluatePublicationGuardrails,
  type PublicationGuardrailsEvaluation,
  type ResidenceForPublicationGuardrails,
} from '@primexpert/core/diffusion';

const PREVIEW_PUBLIC_ID = '00000000-0000-4000-8000-000000000002';

export function usePublicationGuardrails(
  residenceDoc: Record<string, unknown> | null | undefined
): PublicationGuardrailsEvaluation | null {
  return useMemo(() => {
    if (!residenceDoc) return null;
    try {
      const residence = residenceDoc as ResidenceForPublicationGuardrails;
      const publicListing = buildPublicListing(residence, PREVIEW_PUBLIC_ID, {
        visibility: PUBLIC_LISTING_STATUS.MASQUE,
      });
      return evaluatePublicationGuardrails(residence, publicListing);
    } catch {
      return null;
    }
  }, [residenceDoc]);
}
