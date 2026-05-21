/**
 * Liaisons coacheteurs — tableau `coBuyerIds` sur `organizations/{orgId}/contacts`.
 * Synchronisation bidirectionnelle (pas de sous-collection).
 */

/** Ajoute un coacheteur sur la fiche contact (sans doublon). */
export function syncAddCoBuyerId(
  coBuyerIds: readonly string[] | undefined,
  partnerContactId: string
): string[] {
  const id = partnerContactId.trim();
  if (!id) return [...(coBuyerIds ?? [])];
  const set = new Set(coBuyerIds ?? []);
  set.add(id);
  return Array.from(set);
}

/** Retire un coacheteur de la fiche contact. */
export function syncRemoveCoBuyerId(
  coBuyerIds: readonly string[] | undefined,
  partnerContactId: string
): string[] {
  const id = partnerContactId.trim();
  if (!id) return [...(coBuyerIds ?? [])];
  return (coBuyerIds ?? []).filter((c) => c !== id);
}
