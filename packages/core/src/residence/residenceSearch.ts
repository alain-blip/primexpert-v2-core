/**
 * Recherche locale des inscriptions — correspondance partielle, insensible casse/accents.
 */

export interface ResidenceSearchFields {
  id?: string;
  address?: string;
  adresse?: string | Record<string, unknown>;
  city?: string;
  ville?: string;
  municipalite?: string;
  municipality?: string;
  localite?: string;
  nomVille?: string;
  name?: string;
  nomResidence?: string;
  residenceName?: string;
  nomCommercial?: string;
  nom_commercial?: string;
  commercialName?: string;
  region?: string;
  legal?: { raisonSociale?: string | null } | null;
}

const CITY_FIELD_KEYS = [
  'ville',
  'city',
  'municipalite',
  'municipality',
  'localite',
  'nomVille',
] as const;

function pickSearchString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed && trimmed !== '—') return trimmed;
    }
  }
  return undefined;
}

/** Normalise pour comparaison (minuscules, sans diacritiques). */
export function normalizeResidenceSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Tous les noms de villes / municipalités d'une fiche (racine + bloc `adresse`). */
export function collectResidenceCityNames(source: ResidenceSearchFields): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string | undefined) => {
    if (!raw) return;
    const key = normalizeResidenceSearchText(raw);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(raw.trim());
  };

  for (const field of [
    source.city,
    source.ville,
    source.municipalite,
    source.municipality,
    source.localite,
    source.nomVille,
  ]) {
    add(field);
  }

  const adresseRaw = source.adresse;
  if (adresseRaw && typeof adresseRaw === 'object' && !Array.isArray(adresseRaw)) {
    for (const key of CITY_FIELD_KEYS) {
      add(pickSearchString(adresseRaw[key]));
    }
  }

  return out;
}

/** Extrait ligne d'adresse + villes depuis Firestore (y compris `adresse.ville`). */
export function extractResidenceAddressAndCities(data: Record<string, unknown>): {
  address: string;
  city: string;
  ville?: string;
  municipalite?: string;
} {
  const adresseRaw = data.adresse;
  let ligne1: string | undefined;
  const cityNames: string[] = [];

  if (adresseRaw && typeof adresseRaw === 'object' && !Array.isArray(adresseRaw)) {
    const block = adresseRaw as Record<string, unknown>;
    ligne1 = pickSearchString(block.ligne1, block.address, block.rue, block.street);
    for (const key of CITY_FIELD_KEYS) {
      const v = pickSearchString(block[key]);
      if (v) cityNames.push(v);
    }
  }

  for (const key of CITY_FIELD_KEYS) {
    const v = pickSearchString(data[key]);
    if (v) cityNames.push(v);
  }

  const uniqueCities = [...new Set(cityNames)];
  const address =
    pickSearchString(
      data.address,
      typeof adresseRaw === 'string' ? adresseRaw : undefined,
      ligne1
    ) ?? '—';
  const city = uniqueCities[0] ?? '—';

  return {
    address,
    city,
    ville: pickSearchString(data.ville, uniqueCities[0]),
    municipalite: pickSearchString(data.municipalite, data.municipality),
  };
}

function collectResidenceSearchHaystack(residence: ResidenceSearchFields): string {
  const parts: string[] = [
    residence.id,
    residence.address,
    typeof residence.adresse === 'string' ? residence.adresse : undefined,
    ...collectResidenceCityNames(residence),
    residence.region,
    residence.name,
    residence.nomResidence,
    residence.residenceName,
    residence.nomCommercial,
    residence.nom_commercial,
    residence.commercialName,
    residence.legal?.raisonSociale ?? undefined,
  ];
  return parts
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(normalizeResidenceSearchText)
    .join(' ');
}

/** Correspondance partielle sur nom, adresse, villes, raison sociale, identifiant. */
export function residenceMatchesSearchQuery(
  residence: ResidenceSearchFields,
  queryRaw: string
): boolean {
  const q = normalizeResidenceSearchText(queryRaw);
  if (!q) return true;
  const haystack = collectResidenceSearchHaystack(residence);
  if (!haystack) return false;
  return haystack.includes(q);
}

export function filterResidencesBySearchQuery<T extends ResidenceSearchFields>(
  rows: readonly T[],
  queryRaw: string
): T[] {
  const q = queryRaw.trim();
  if (!q) return [...rows];
  return rows.filter((r) => residenceMatchesSearchQuery(r, q));
}
