import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ASSET_NICHE_IDS, type AssetNiche } from '../types/residence';

const STORAGE_KEY = 'primexpert-active-silo';

function readStoredSilo(): AssetNiche | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'RPA' || raw === 'CPE' || raw === 'PLEX') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function normalizeAccessible(raw: unknown): AssetNiche[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...ASSET_NICHE_IDS];
  const out: AssetNiche[] = [];
  for (const x of raw) {
    if (x === 'RPA' || x === 'CPE' || x === 'PLEX') out.push(x);
  }
  return out.length > 0 ? out : [...ASSET_NICHE_IDS];
}

export interface SiloContextValue {
  /** Silo actuellement affiché (cloisons étanches UI + requêtes). */
  activeSilo: AssetNiche;
  setActiveSilo: (s: AssetNiche) => void;
  /** Silos autorisés pour ce profil (RBAC — défaut : les trois). */
  accessibleSilos: readonly AssetNiche[];
  canAccess: (s: AssetNiche) => boolean;
}

const SiloContext = createContext<SiloContextValue | null>(null);

export interface SiloProviderProps {
  children: React.ReactNode;
  /** Depuis `users/{uid}.accessibleSilos` (Firestore). Absent = tous les silos. */
  accessibleSilosFromProfile?: unknown;
}

export function SiloProvider({ children, accessibleSilosFromProfile }: SiloProviderProps) {
  const accessibleSilos = useMemo(
    () => normalizeAccessible(accessibleSilosFromProfile),
    [accessibleSilosFromProfile]
  );

  const [activeSilo, setActiveSiloState] = useState<AssetNiche>(() => {
    const stored = readStoredSilo();
    const allowed = normalizeAccessible(accessibleSilosFromProfile);
    if (stored && allowed.includes(stored)) return stored;
    return allowed[0] ?? 'RPA';
  });

  useEffect(() => {
    if (!accessibleSilos.includes(activeSilo)) {
      setActiveSiloState(accessibleSilos[0] ?? 'RPA');
    }
  }, [accessibleSilos, activeSilo]);

  const setActiveSilo = useCallback(
    (s: AssetNiche) => {
      if (!accessibleSilos.includes(s)) return;
      setActiveSiloState(s);
      try {
        localStorage.setItem(STORAGE_KEY, s);
      } catch {
        /* ignore */
      }
    },
    [accessibleSilos]
  );

  const canAccess = useCallback((s: AssetNiche) => accessibleSilos.includes(s), [accessibleSilos]);

  const value = useMemo<SiloContextValue>(
    () => ({
      activeSilo,
      setActiveSilo,
      accessibleSilos,
      canAccess,
    }),
    [activeSilo, setActiveSilo, accessibleSilos, canAccess]
  );

  return <SiloContext.Provider value={value}>{children}</SiloContext.Provider>;
}

export function useSilo(): SiloContextValue {
  const ctx = useContext(SiloContext);
  if (!ctx) {
    throw new Error('useSilo must be used within SiloProvider');
  }
  return ctx;
}
