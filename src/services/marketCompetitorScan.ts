/**
 * Scan Firestore des résidences pour analyse comparative Haversine.
 */

import { collection, getDocs, limit, query } from 'firebase/firestore';
import {
  buildMarketAnalysisPatch,
  runProgressiveCompetitorSearch,
  type ResidenceGeoCandidate,
} from '@primexpert/core/market';
import { db } from '../lib/firebase';

const SCAN_LIMIT = 500;

export async function scanMarketCompetitors(
  residenceId: string,
  lat: number,
  lng: number,
  lang: 'fr' | 'en' = 'fr'
): Promise<Record<string, unknown>> {
  const snapshot = await getDocs(query(collection(db, 'residences'), limit(SCAN_LIMIT)));
  const candidates: ResidenceGeoCandidate[] = snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  }));

  const result = runProgressiveCompetitorSearch(lat, lng, candidates, residenceId, lang);
  return buildMarketAnalysisPatch(result);
}
