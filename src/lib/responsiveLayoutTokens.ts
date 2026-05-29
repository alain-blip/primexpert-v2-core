/**
 * Tokens breakpoints SPA V2.8 — layout adaptatif (pur UI, aucune I/O).
 */

/** Fond cockpit haut contraste — uniforme mobile / tablette / laptop. */
export const COCKPIT_SURFACE_BG = '#0B0F19' as const;

export const RESPONSIVE_BREAKPOINTS = {
  /** Largeur max mobile (exclusive tablette). */
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1199,
  laptopMin: 1200,
} as const;

export type ResponsiveLayoutMode = 'mobile' | 'tablet' | 'laptop';

export function resolveResponsiveLayoutMode(width: number): ResponsiveLayoutMode {
  if (!Number.isFinite(width) || width <= 0) return 'mobile';
  if (width <= RESPONSIVE_BREAKPOINTS.mobileMax) return 'mobile';
  if (width < RESPONSIVE_BREAKPOINTS.laptopMin) return 'tablet';
  return 'laptop';
}

/** Largeur viewport fiable (Safari iOS : visualViewport + repli mobile). */
export function measureViewportWidth(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const vv = window.visualViewport?.width;
    const inner = window.innerWidth;
    const w = typeof vv === 'number' && vv > 0 ? vv : inner;
    if (Number.isFinite(w) && w > 0) return w;
  } catch {
    /* premier rendu mobile instable — repli ci-dessous */
  }
  return RESPONSIVE_BREAKPOINTS.mobileMax;
}
