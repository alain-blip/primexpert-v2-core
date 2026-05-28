/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/crm/
 * Régénéré : functions/scripts/sync-core-crm.cjs (prebuild)
 */
/**
 * Radar à opportunités (prospection IA off-market) — signaux faibles territoriaux.
 * SSOT notation ; persistance Firestore : organizations/{orgId}/prospects_radar
 */

export type RadarSignalType = 'occupancy_drop' | 'certification_expiry';

export interface RadarResidenceSignalInput {
  residenceId: string;
  address: string;
  city?: string | null;
  brokerId: string;
  /** Taux d'occupation actuel (0–100 ou 0–1 normalisé en amont). */
  tauxOccupation?: number | null;
  /** Référence précédente (ex. snapshot J-30). */
  previousTauxOccupation?: number | null;
  /** Échéance certification CIUSSS / MSSS (ms). */
  certificationDueMillis?: number | null;
}

export interface RadarOpportunityRecord {
  id: string;
  orgId: string;
  brokerId: string;
  residenceId: string;
  signalType: RadarSignalType;
  score: number;
  propertyLabel: string;
  titleFr: string;
  titleEn: string;
  summaryFr: string;
  summaryEn: string;
  detectedAtMillis: number;
}

const OCCUPANCY_DROP_PP = 5;
const OCCUPANCY_LOW_THRESHOLD = 85;
const CERTIFICATION_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeOccupancyPct(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  if (raw > 0 && raw <= 1) return raw * 100;
  return raw;
}

function buildPropertyLabel(input: RadarResidenceSignalInput): string {
  const city = input.city?.trim();
  return city ? `${input.address}, ${city}` : input.address;
}

function scoreOccupancyDrop(
  input: RadarResidenceSignalInput,
  occupancy: number,
  previous: number | null
): number {
  let score = 40;
  if (occupancy < OCCUPANCY_LOW_THRESHOLD) {
    score += Math.min(35, OCCUPANCY_LOW_THRESHOLD - occupancy);
  }
  if (previous != null && previous - occupancy >= OCCUPANCY_DROP_PP) {
    score += Math.min(25, (previous - occupancy) * 2);
  }
  return clampScore(score);
}

function scoreCertificationExpiry(daysUntil: number): number {
  if (daysUntil < 0) return clampScore(95);
  if (daysUntil <= 14) return clampScore(90 - daysUntil);
  if (daysUntil <= 30) return clampScore(75 - daysUntil * 0.5);
  return clampScore(55 - daysUntil * 0.2);
}

/**
 * Évalue les signaux faibles et produit les enregistrements à persister dans prospects_radar.
 */
export function scoreRadarOpportunities(
  orgId: string,
  inputs: readonly RadarResidenceSignalInput[],
  now = Date.now()
): RadarOpportunityRecord[] {
  const out: RadarOpportunityRecord[] = [];
  const org = orgId.trim();
  if (!org) return out;

  for (const input of inputs) {
    const propertyLabel = buildPropertyLabel(input);
    const occupancy = normalizeOccupancyPct(input.tauxOccupation);
    const previous = normalizeOccupancyPct(input.previousTauxOccupation ?? null);

    if (occupancy != null) {
      const drop =
        (previous != null && previous - occupancy >= OCCUPANCY_DROP_PP) ||
        occupancy < OCCUPANCY_LOW_THRESHOLD;
      if (drop) {
        const score = scoreOccupancyDrop(input, occupancy, previous);
        const delta =
          previous != null ? `${(previous - occupancy).toFixed(1)} pts` : `${occupancy.toFixed(1)} %`;
        out.push({
          id: `${input.residenceId}_occupancy_drop`,
          orgId: org,
          brokerId: input.brokerId,
          residenceId: input.residenceId,
          signalType: 'occupancy_drop',
          score,
          propertyLabel,
          titleFr: 'Baisse du taux d\'occupation détectée',
          titleEn: 'Occupancy rate decline detected',
          summaryFr: `Signal faible : taux d'occupation à ${occupancy.toFixed(1)} %${previous != null ? ` (écart ${delta})` : ''}. Prospection off-market recommandée.`,
          summaryEn: `Weak signal: occupancy at ${occupancy.toFixed(1)}%${previous != null ? ` (${delta} change)` : ''}. Off-market outreach recommended.`,
          detectedAtMillis: now,
        });
      }
    }

    const certDue = input.certificationDueMillis;
    if (certDue != null && Number.isFinite(certDue)) {
      const daysUntil = (certDue - now) / (24 * 60 * 60 * 1000);
      if (daysUntil <= CERTIFICATION_WINDOW_MS / (24 * 60 * 60 * 1000)) {
        const score = scoreCertificationExpiry(daysUntil);
        out.push({
          id: `${input.residenceId}_certification_expiry`,
          orgId: org,
          brokerId: input.brokerId,
          residenceId: input.residenceId,
          signalType: 'certification_expiry',
          score,
          propertyLabel,
          titleFr: 'Expiration prochaine — certification CIUSSS',
          titleEn: 'Upcoming expiry — CIUSSS certification',
          summaryFr: `Échéance réglementaire sous ${Math.max(0, Math.ceil(daysUntil))} j — opportunité de mandat ou de renouvellement.`,
          summaryEn: `Regulatory deadline within ${Math.max(0, Math.ceil(daysUntil))} d — listing or renewal opportunity.`,
          detectedAtMillis: now,
        });
      }
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

export function radarDocIdForRecord(record: Pick<RadarOpportunityRecord, 'residenceId' | 'signalType'>): string {
  return `${record.residenceId}_${record.signalType}`;
}

/** Placeholder charte — aucun signal détecté (FR exact, spec v2026.2). */
export const RADAR_OPPORTUNITIES_IDLE_MESSAGE_FR =
  'Radar en veille active. Aucun signal faible détecté dans votre secteur pour le moment.';

export const RADAR_OPPORTUNITIES_IDLE_MESSAGE_EN =
  'Radar on active watch. No weak signals detected in your sector at this time.';
