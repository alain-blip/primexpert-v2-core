import React, { createContext, useContext, useMemo } from 'react';
import type { ResponsiveLayoutMode } from '../../lib/responsiveLayoutTokens';

export interface ResponsiveLayoutContextValue {
  mode: ResponsiveLayoutMode;
  isMobile: boolean;
  isTablet: boolean;
  isLaptop: boolean;
}

/** Repli immédiat — jamais de `return null` ni attente viewport au démarrage global. */
export const RESPONSIVE_LAYOUT_MOBILE_FALLBACK: ResponsiveLayoutContextValue = {
  mode: 'mobile',
  isMobile: true,
  isTablet: false,
  isLaptop: false,
};

export function buildResponsiveLayoutContextValue(
  mode: ResponsiveLayoutMode
): ResponsiveLayoutContextValue {
  return {
    mode,
    isMobile: mode === 'mobile',
    isTablet: mode === 'tablet',
    isLaptop: mode === 'laptop',
  };
}

export const ResponsiveLayoutContext = createContext<ResponsiveLayoutContextValue>(
  RESPONSIVE_LAYOUT_MOBILE_FALLBACK
);

/**
 * Fournisseur statique (tests / Storybook) — aucun hook viewport, rendu immédiat.
 * En production workhub : contexte injecté par `AppResponsiveLayout` uniquement.
 */
export function ResponsiveLayoutProvider({
  children,
  mode = 'mobile',
}: {
  children: React.ReactNode;
  mode?: ResponsiveLayoutMode;
}) {
  const value = useMemo(() => buildResponsiveLayoutContextValue(mode), [mode]);
  return (
    <ResponsiveLayoutContext.Provider value={value}>
      {children}
    </ResponsiveLayoutContext.Provider>
  );
}

export function useResponsiveLayout(): ResponsiveLayoutContextValue {
  return useContext(ResponsiveLayoutContext);
}
