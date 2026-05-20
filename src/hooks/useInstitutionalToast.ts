/**
 * Retour utilisateur institutionnel (succès / erreur) — équivalent Toast V2.
 * Auto-disparition après 6 s ; bannière fixe en haut du panneau parent.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type InstitutionalToastVariant = 'success' | 'error' | 'info';

export interface InstitutionalToastState {
  message: string;
  variant: InstitutionalToastVariant;
}

const AUTO_DISMISS_MS = 6000;

export function useInstitutionalToast() {
  const [toast, setToast] = useState<InstitutionalToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (message: string, variant: InstitutionalToastVariant) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, variant });
      timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    },
    []
  );

  const showSuccess = useCallback(
    (message: string) => show(message, 'success'),
    [show]
  );

  const showError = useCallback((message: string) => show(message, 'error'), [show]);

  const showInfo = useCallback((message: string) => show(message, 'info'), [show]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { toast, showSuccess, showError, showInfo, dismiss };
}
