/**
 * Registre des visites physiques (achalandage) — persistance tableau Firestore.
 */

import type { VisitorEntranceCoords, VisitorTractionStats, VisitorVisitEntry } from './types';

export function parseVisitorVisitRegistry(doc: Record<string, unknown> | null): VisitorVisitEntry[] {
  const raw = doc?.visitorVisitRegistry;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is VisitorVisitEntry => e != null && typeof e === 'object' && 'id' in e)
    .sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime());
}

export function parseVisitorEntrance(doc: Record<string, unknown> | null): VisitorEntranceCoords | null {
  const raw = doc?.visitorEntrance;
  if (!raw || typeof raw !== 'object') return null;
  const ve = raw as Record<string, unknown>;
  const lat = Number(ve.lat);
  const lng = Number(ve.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    lat,
    lng,
    label: typeof ve.label === 'string' ? ve.label : undefined,
    source: typeof ve.source === 'string' ? ve.source : undefined,
    placeId: typeof ve.placeId === 'string' ? ve.placeId : undefined,
    updatedAt: typeof ve.updatedAt === 'string' ? ve.updatedAt : undefined,
  };
}

export function computeVisitorTractionStats(entries: VisitorVisitEntry[]): VisitorTractionStats {
  const now = Date.now();
  const ms30 = 30 * 24 * 60 * 60 * 1000;
  const ms90 = 90 * 24 * 60 * 60 * 1000;
  const byChannel: Record<string, number> = {};

  let visitsLast30Days = 0;
  let visitsLast90Days = 0;
  let lastVisitAt: string | null = null;

  for (const entry of entries) {
    const t = new Date(entry.visitedAt).getTime();
    if (Number.isNaN(t)) continue;
    if (!lastVisitAt || t > new Date(lastVisitAt).getTime()) {
      lastVisitAt = entry.visitedAt;
    }
    if (now - t <= ms30) visitsLast30Days++;
    if (now - t <= ms90) visitsLast90Days++;
    const ch = entry.channel ?? 'other';
    byChannel[ch] = (byChannel[ch] ?? 0) + 1;
  }

  return {
    totalVisits: entries.length,
    visitsLast30Days,
    visitsLast90Days,
    lastVisitAt,
    byChannel,
  };
}

export function createVisitorVisitEntry(
  partial: Pick<VisitorVisitEntry, 'visitedAt'> &
    Partial<Omit<VisitorVisitEntry, 'id' | 'recordedAt'>>
): VisitorVisitEntry {
  return {
    id: `vv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    recordedAt: new Date().toISOString(),
    channel: 'walk_in',
    ...partial,
  };
}

export function haversineKmBetweenEntrances(
  marketLat: number,
  marketLng: number,
  entrance: VisitorEntranceCoords
): number {
  const R = 6371;
  const dLat = ((entrance.lat - marketLat) * Math.PI) / 180;
  const dLng = ((entrance.lng - marketLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((marketLat * Math.PI) / 180) *
      Math.cos((entrance.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
