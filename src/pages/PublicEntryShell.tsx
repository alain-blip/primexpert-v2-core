/**
 * Coque d'entrée publique V2.8 — HTML5 / Tailwind brut uniquement.
 * Aucun ResponsiveLayoutProvider ni AppResponsiveLayout (bypass total au login).
 */

import React from 'react';

export function PublicEntryShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
