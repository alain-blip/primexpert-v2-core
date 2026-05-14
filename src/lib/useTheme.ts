/**
 * useTheme — bascule "Navigateur Bleu" ↔ "Clair atténué".
 *
 * Architecture KISS :
 *  - La classe `dark` ou `light` est posée sur <html> par un mini script
 *    dans index.html AVANT le rendu React (anti-flash).
 *  - Ce hook lit/écrit `localStorage.theme` et synchronise la classe.
 *  - Tous les composants restent inchangés : c'est `index.css` qui
 *    redéfinit les utilitaires (`.bg-vault`, `.workhub-card`, etc.) selon
 *    le sélecteur `html.light` / `html.dark`. Zéro duplication.
 */
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

function readInitial(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* localStorage indisponible (mode privé, quota) — on continue silencieusement */
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggle };
}
