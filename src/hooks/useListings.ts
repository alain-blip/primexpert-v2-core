import { useAuth } from '../lib/auth';
import { useSilo } from '../context/SiloContext';
import { useInventoryResidences, usePipelineResidences } from './useResidences';

/**
 * Pipeline inscriptions filtré par le silo cockpit actif (Firestore + garde client RPA legacy).
 */
export function useListingsPipeline(enabled = true) {
  const { profile } = useAuth();
  const { activeSilo } = useSilo();
  return usePipelineResidences(profile, Boolean(profile?.uid) && enabled, activeSilo);
}

/**
 * Inventaire (pagination + recherche) scellé sur le silo actif.
 */
export function useListingsInventory(opts: { enabled: boolean; searchPrefix: string }) {
  const { profile } = useAuth();
  const { activeSilo } = useSilo();
  return useInventoryResidences(profile, opts, activeSilo);
}
