import { useEffect, useState } from 'react';
import {
  measureViewportWidth,
  resolveResponsiveLayoutMode,
  type ResponsiveLayoutMode,
} from '../lib/responsiveLayoutTokens';

function detectLayoutMode(): ResponsiveLayoutMode {
  try {
    if (typeof window === 'undefined') return 'mobile';
    return resolveResponsiveLayoutMode(measureViewportWidth());
  } catch {
    return 'mobile';
  }
}

/**
 * Détection viewport — standards industrie (< 768 / 768–1199 / ≥ 1200).
 * Premier rendu / hydratation : toujours `mobile` (aucun accès `window`).
 * Mesure réelle : uniquement après montage (`useEffect`, écoute passive).
 */
export function useResponsiveLayoutMode(): ResponsiveLayoutMode {
  const [mode, setMode] = useState<ResponsiveLayoutMode>('mobile');

  useEffect(() => {
    const sync = () => {
      try {
        setMode(detectLayoutMode());
      } catch {
        setMode('mobile');
      }
    };

    sync();

    window.addEventListener('resize', sync, { passive: true });
    window.visualViewport?.addEventListener('resize', sync, { passive: true });

    return () => {
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, []);

  return mode;
}
