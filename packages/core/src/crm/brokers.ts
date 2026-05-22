/**
 * Liaisons courtier ↔ acheteurs gérés — `brokerCriteria.managedBuyerIds`
 * + `ownerId` acheteur (courtier responsable = propriétaire de la fiche courtier).
 */

/** Ajoute un acheteur géré sur la fiche courtier (sans doublon). */
export function syncAddManagedBuyerId(
  managedBuyerIds: readonly string[] | undefined,
  buyerContactId: string
): string[] {
  const id = buyerContactId.trim();
  if (!id) return [...(managedBuyerIds ?? [])];
  const set = new Set(managedBuyerIds ?? []);
  set.add(id);
  return Array.from(set);
}

/** Retire un acheteur géré de la fiche courtier. */
export function syncRemoveManagedBuyerId(
  managedBuyerIds: readonly string[] | undefined,
  buyerContactId: string
): string[] {
  const id = buyerContactId.trim();
  if (!id) return [...(managedBuyerIds ?? [])];
  return (managedBuyerIds ?? []).filter((c) => c !== id);
}
