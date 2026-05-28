/**
 * Bouclier anti-doublons — Statistiques du marché (Big Data).
 * Adapté de Copilote legacy `marketComparableDedupe.js` + empreintes Firestore déterministes.
 */

export interface ComparableSaleCandidate {
  adresse?: string | null;
  ville?: string | null;
  ville_comparable?: string | null;
  dateTransaction?: string | null;
  date_vente?: string | null;
  date_pa_acceptee?: string | null;
  prixVente?: number | null;
  prix_vente?: number | null;
}

export interface ExistingComparableSaleDoc extends ComparableSaleCandidate {
  id: string;
  source?: string | null;
}

export type DedupeMatchStrength = 'high' | 'weak';

export interface DedupeSaleMatch {
  strength: DedupeMatchStrength;
  id: string;
  preview: ExistingComparableSaleDoc;
}

export interface DedupeRowMetadata {
  status: 'unique' | 'duplicate';
  strength?: DedupeMatchStrength;
  existingId?: string;
  existingPreview?: {
    ville_comparable: string | null;
    prix_vente: number | null;
    date_vente: string | null;
    source: string | null;
  };
  userAction: 'import' | 'skip';
}

export interface IaOpportunityScoring {
  score: number;
  criticalFactors: string[];
  evaluatedAt: string;
}

export interface OpportunityScoringInput {
  selectedRegionsCount: number;
  selectedTransactionsCount: number;
  selectedOperationalBenchmarksCount: number;
  hasSourcePublisher: boolean;
  hasDocumentType: boolean;
  parsingStatus?: string | null;
}

const MAX_FIRESTORE_DOC_ID = 1500;

/** Normalise adresse / ville pour comparaison (legacy). */
export function normalizeComparableAddress(value: unknown): string {
  if (value == null || value === '') return '';
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse une date de vente (ISO, JJ/MM/AAAA, Timestamp-like). */
export function parseComparableSaleDate(input: unknown): Date | null {
  if (input == null || input === '') return null;
  if (typeof input === 'object' && input !== null && 'toDate' in input) {
    try {
      const d = (input as { toDate: () => Date }).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;
  const s = String(input).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

export function datesWithinDays(d1: Date | null, d2: Date | null, days: number): boolean {
  if (!d1 || !d2) return false;
  return Math.abs(d1.getTime() - d2.getTime()) <= days * 86400000;
}

export function roundComparablePrice(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function resolveComparableLocation(row: ComparableSaleCandidate): string {
  const raw =
    row.adresse ??
    row.ville ??
    row.ville_comparable ??
    '';
  return normalizeComparableAddress(raw);
}

export function resolveComparablePrice(row: ComparableSaleCandidate): number | null {
  return roundComparablePrice(row.prixVente ?? row.prix_vente);
}

export function resolveComparableDate(row: ComparableSaleCandidate): Date | null {
  return parseComparableSaleDate(
    row.dateTransaction ?? row.date_vente ?? row.date_pa_acceptee
  );
}

/** Clé date compacte pour empreinte Firestore (AAAAMMJJ). */
export function normalizeTransactionDateKey(input: unknown): string {
  const d = parseComparableSaleDate(input);
  if (!d) return 'sans-date';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Slug URL-safe pour identifiants Firestore. */
export function slugifyForFirestoreId(value: string, maxLength = 80): string {
  const base = normalizeComparableAddress(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const trimmed = base.slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : 'inconnu';
}

function hashToDocId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return `h${(h >>> 0).toString(36)}`;
}

/** Garantit un ID Firestore valide (longueur, pas de slash). */
export function ensureFirestoreDocId(raw: string): string {
  const cleaned = raw.replace(/\//g, '-');
  if (cleaned.length > 0 && cleaned.length <= MAX_FIRESTORE_DOC_ID) return cleaned;
  return hashToDocId(raw);
}

/** Empreinte transaction — slug(adresse|ville)_date_prix (+ silo). */
export function marketTransactionFingerprint(input: {
  adresse?: string | null;
  ville?: string | null;
  dateTransaction?: string | null;
  prixVente?: number | null;
  siloType?: string;
}): string {
  const location = slugifyForFirestoreId(
    String(input.adresse ?? input.ville ?? 'ville-inconnue').trim()
  );
  const datePart = normalizeTransactionDateKey(input.dateTransaction);
  const prix = roundComparablePrice(input.prixVente) ?? 0;
  const silo = slugifyForFirestoreId(input.siloType ?? 'rpa_ri_chsld', 32);
  return ensureFirestoreDocId(`${silo}__tx__${location}__${datePart}__${prix}`);
}

/** Empreinte macro Altus — region_annee_type. */
export function marketMacroRegionFingerprint(input: {
  regionAdministrative: string;
  anneeDonnees: number;
  documentType: string;
}): string {
  const region = slugifyForFirestoreId(input.regionAdministrative);
  const type = slugifyForFirestoreId(input.documentType, 60);
  return ensureFirestoreDocId(`macro__${region}__${input.anneeDonnees}__${type}`);
}

/** Empreinte ratio / benchmark opérationnel. */
export function marketOperationalBenchmarkFingerprint(input: {
  label: string;
  regionAdministrative: string;
  anneeDonnees: number;
  siloType?: string;
}): string {
  const silo = slugifyForFirestoreId(input.siloType ?? 'rpa_ri_chsld', 32);
  const region = slugifyForFirestoreId(input.regionAdministrative);
  const label = slugifyForFirestoreId(input.label, 60);
  return ensureFirestoreDocId(
    `${silo}__bench__${region}__${label}__${input.anneeDonnees}`
  );
}

/**
 * Correspondance legacy — adresse normalisée + prix exact + date ±3 jours.
 */
export function findDuplicateSaleMatch(
  candidate: ComparableSaleCandidate,
  existingList: ExistingComparableSaleDoc[],
  opts: { toleranceDays?: number } = {}
): DedupeSaleMatch | null {
  const toleranceDays = opts.toleranceDays ?? 3;
  const addr = resolveComparableLocation(candidate);
  const prix = resolveComparablePrice(candidate);
  if (!addr || prix == null || prix <= 0) return null;

  const candDate = resolveComparableDate(candidate);
  let weakCandidate: DedupeSaleMatch | null = null;

  for (const ex of existingList) {
    if (resolveComparableLocation(ex) !== addr) continue;
    if (resolveComparablePrice(ex) !== prix) continue;

    const exDate = resolveComparableDate(ex);

    if (candDate && exDate) {
      if (datesWithinDays(candDate, exDate, toleranceDays)) {
        return { strength: 'high', id: ex.id, preview: ex };
      }
      continue;
    }

    if (!weakCandidate) {
      weakCandidate = { strength: 'weak', id: ex.id, preview: ex };
    }
  }

  return weakCandidate;
}

/** Attache _dedupe à chaque ligne vente (copie immuable, legacy UI). */
export function attachDedupeMetadata<T extends ComparableSaleCandidate>(
  venteRows: T[],
  existingSaleDocs: ExistingComparableSaleDoc[]
): Array<T & { _dedupe: DedupeRowMetadata }> {
  return venteRows.map((row) => {
    const match = findDuplicateSaleMatch(row, existingSaleDocs);
    if (!match) {
      return {
        ...row,
        _dedupe: { status: 'unique', userAction: 'import' },
      };
    }
    return {
      ...row,
      _dedupe: {
        status: 'duplicate',
        strength: match.strength,
        existingId: match.id,
        existingPreview: {
          ville_comparable:
            match.preview.ville_comparable ??
            match.preview.ville ??
            match.preview.adresse ??
            null,
          prix_vente: resolveComparablePrice(match.preview),
          date_vente:
            match.preview.date_vente ??
            match.preview.dateTransaction ??
            match.preview.date_pa_acceptee ??
            null,
          source: match.preview.source ?? null,
        },
        userAction: 'skip',
      },
    };
  });
}

export function stripDedupeFields<T extends Record<string, unknown>>(row: T): Omit<T, '_dedupe'> {
  if (!row || typeof row !== 'object') return row as Omit<T, '_dedupe'>;
  const { _dedupe: _ignored, ...rest } = row;
  return rest as Omit<T, '_dedupe'>;
}

/**
 * Score de signaux faibles (prospection IA) à injecter sur `market_documents`.
 * Enrichissement incrémental, sans collection parallèle.
 */
export function evaluateMarketOpportunityScoring(input: OpportunityScoringInput): IaOpportunityScoring {
  const factors: string[] = [];
  let score = 0;

  if (input.selectedRegionsCount > 0) {
    score += Math.min(30, input.selectedRegionsCount * 5);
    factors.push('Couverture régionale validée');
  }
  if (input.selectedTransactionsCount > 0) {
    score += Math.min(35, input.selectedTransactionsCount * 2);
    factors.push('Transactions comparables disponibles');
  }
  if (input.selectedOperationalBenchmarksCount > 0) {
    score += Math.min(20, input.selectedOperationalBenchmarksCount * 2);
    factors.push('Ratios de performance exploitables');
  }
  if (input.hasSourcePublisher) {
    score += 8;
    factors.push('Source publiée identifiée');
  }
  if (input.hasDocumentType) {
    score += 7;
    factors.push('Type de rapport catégorisé');
  }
  if (input.parsingStatus === 'verified' || input.parsingStatus === 'completed') {
    score += 10;
    factors.push('Extraction vérifiée par contrôle humain');
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: boundedScore,
    criticalFactors: factors.slice(0, 5),
    evaluatedAt: new Date().toISOString(),
  };
}
