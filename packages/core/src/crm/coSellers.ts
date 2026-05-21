/**
 * Liaisons covendeurs — tableau `coSellerIds` sur `organizations/{orgId}/contacts`.
 * Synchronisation bidirectionnelle (pas de sous-collection).
 */

/** Ajoute un covendeur sur la fiche contact (sans doublon). */
export function syncAddCoSellerId(
  coSellerIds: readonly string[] | undefined,
  partnerContactId: string
): string[] {
  const id = partnerContactId.trim();
  if (!id) return [...(coSellerIds ?? [])];
  const set = new Set(coSellerIds ?? []);
  set.add(id);
  return Array.from(set);
}

/** Retire un covendeur de la fiche contact. */
export function syncRemoveCoSellerId(
  coSellerIds: readonly string[] | undefined,
  partnerContactId: string
): string[] {
  const id = partnerContactId.trim();
  if (!id) return [...(coSellerIds ?? [])];
  return (coSellerIds ?? []).filter((c) => c !== id);
}
