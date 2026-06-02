/**
 * Contexte de propriété — énumération canonique hermétique (SSOT v3.5)
 *
 * Bascule cockpit à 4 contextes étanches. La tuyauterie lourde (base de données,
 * Hub Omnicanal, téléphonie, messagerie, coffre-fort documentaire) demeure
 * COMMUNE et inchangée ; seules les vues filtrent par contexte.
 *
 * RÈGLE #0 — Ce type est la SOURCE UNIQUE DE VÉRITÉ pour « quel type d'actif ».
 * Les notions historiques `AssetNiche` (RPA | CPE | PLEX, `src/types/residence.ts`)
 * et `RadarPropertyType` (rpa | cpe | plex | commercial) se MAPPENT dessus via les
 * ponts ci-dessous — aucune énumération concurrente n'est autorisée.
 *
 * CPE = miroir de RPA : le contexte des centres de la petite enfance (CPE) réutilise
 * le modèle opérationnel des résidences pour aînés (RPA).
 */

/** Énumération canonique des 4 contextes (source de vérité runtime). */
export const PROPERTY_CONTEXTS = [
  'RESIDENTIAL',
  'COMMERCIAL_PLEX',
  'RPA',
  'CPE',
] as const;

/**
 * Contexte de propriété — quad-contexte hermétique.
 *
 * export type PropertyContext = 'RESIDENTIAL' | 'COMMERCIAL_PLEX' | 'RPA' | 'CPE';
 */
export type PropertyContext = (typeof PROPERTY_CONTEXTS)[number];

/** Contexte par défaut (héritage : modèle initial RPA). */
export const DEFAULT_PROPERTY_CONTEXT: PropertyContext = 'RPA';

/**
 * Niche opérationnelle historique — pont structurel vers `AssetNiche`
 * (`src/types/residence.ts`). Mêmes littéraux : assignable sans conversion.
 */
export type LegacyAssetNiche = 'RPA' | 'CPE' | 'PLEX';

/** Libellés bilingues — lexique Québec (abréviation jamais seule). */
export const PROPERTY_CONTEXT_LABELS: Record<
  PropertyContext,
  { labelFr: string; labelEn: string }
> = {
  RESIDENTIAL: { labelFr: 'Résidentiel', labelEn: 'Residential' },
  COMMERCIAL_PLEX: {
    labelFr: 'Plex commercial (multilogement)',
    labelEn: 'Commercial plex (multi-unit)',
  },
  RPA: {
    labelFr: 'Résidence pour aînés (RPA)',
    labelEn: 'Seniors’ residence (RPA)',
  },
  CPE: {
    labelFr: 'Centre de la petite enfance (CPE)',
    labelEn: 'Childcare centre (CPE)',
  },
};

/** Garde de type stricte. */
export function isPropertyContext(value: unknown): value is PropertyContext {
  return (
    typeof value === 'string' &&
    (PROPERTY_CONTEXTS as readonly string[]).includes(value)
  );
}

/**
 * Normalise une valeur brute (Firestore / PDF / import legacy) vers un contexte
 * canonique. Tolère la casse et les alias historiques (`PLEX`, `plex`, `commercial`).
 */
export function parsePropertyContext(raw: unknown): PropertyContext | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toUpperCase();
  if (!v) return undefined;
  if (isPropertyContext(v)) return v;
  // Alias legacy → contexte canonique (enrichissement, pas de duplication).
  switch (v) {
    case 'PLEX':
    case 'MULTIPLEX':
    case 'COMMERCIAL':
      return 'COMMERCIAL_PLEX';
    case 'RESIDENTIEL':
    case 'RES':
    case 'UNIFAMILIAL':
    case 'CONDO':
      return 'RESIDENTIAL';
    default:
      return undefined;
  }
}

/**
 * Pont historique : `AssetNiche` (RPA | CPE | PLEX) → `PropertyContext`.
 * `PLEX` → `COMMERCIAL_PLEX`. (RESIDENTIAL n'a pas d'équivalent niche : contexte net-neuf.)
 */
export function assetNicheToPropertyContext(
  niche: LegacyAssetNiche
): PropertyContext {
  return niche === 'PLEX' ? 'COMMERCIAL_PLEX' : niche;
}

/**
 * Pont inverse : `PropertyContext` → `AssetNiche` opérationnelle.
 * `RESIDENTIAL` n'a pas de niche historique (`undefined`).
 */
export function propertyContextToAssetNiche(
  context: PropertyContext
): LegacyAssetNiche | undefined {
  switch (context) {
    case 'COMMERCIAL_PLEX':
      return 'PLEX';
    case 'RPA':
      return 'RPA';
    case 'CPE':
      return 'CPE';
    case 'RESIDENTIAL':
      return undefined;
  }
}

/**
 * CPE miroir de RPA : vrai pour les contextes partageant le modèle opérationnel
 * « résidence pour aînés » (RPA et CPE), afin de réutiliser les mêmes vues/règles.
 */
export function propertyContextUsesRpaModel(context: PropertyContext): boolean {
  return context === 'RPA' || context === 'CPE';
}

/** Libellé bilingue d'un contexte (FR par défaut). */
export function propertyContextLabel(
  context: PropertyContext,
  lang: 'fr' | 'en' = 'fr'
): string {
  const entry = PROPERTY_CONTEXT_LABELS[context];
  return lang === 'en' ? entry.labelEn : entry.labelFr;
}
