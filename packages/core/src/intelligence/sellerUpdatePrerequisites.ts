/**
 * Prérequis production — envoi Nylas & conformité partage documentaire (dossier).
 */

export interface ListingDocumentReleaseGate {
  ndaSignedValidated: boolean;
  proofOfDepositValidated: boolean;
  /** Les deux conditions explicites au dossier. */
  documentReleaseAllowed: boolean;
}

export interface SellerUpdateSendReadiness {
  ready: boolean;
  errors: string[];
  vendeurEmail: string | null;
}

/** Cible de routage : attribut racine `vendeurEmail` uniquement. */
export function resolveVendeurEmailStrict(
  doc: Record<string, unknown> | null | undefined
): string | null {
  if (!doc) return null;
  const raw = doc.vendeurEmail;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.includes('@')) return null;
  return trimmed;
}

/**
 * Conformité partage documentaire au dossier résidence.
 * Champs canoniques V2 + alias Copilote / sous-objet buyerReleaseGate.
 */
export function resolveListingDocumentReleaseGate(
  doc: Record<string, unknown> | null | undefined
): ListingDocumentReleaseGate {
  if (!doc) {
    return {
      ndaSignedValidated: false,
      proofOfDepositValidated: false,
      documentReleaseAllowed: false,
    };
  }

  const gate =
    doc.buyerReleaseGate && typeof doc.buyerReleaseGate === 'object'
      ? (doc.buyerReleaseGate as Record<string, unknown>)
      : null;

  const ndaSignedValidated = Boolean(
    gate?.ndaSignedValidated === true ||
      doc.ndaAcheteurValide === true ||
      doc.buyerNdaValidated === true ||
      doc.ndaValide === true ||
      doc.ndaSignedValidated === true
  );

  const proofOfDepositValidated = Boolean(
    gate?.proofOfDepositValidated === true ||
      doc.preuveMiseDeFondsValidee === true ||
      doc.buyerProofOfDepositValidated === true ||
      doc.miseDeFondsValidee === true ||
      doc.proofOfDepositValidated === true
  );

  const documentReleaseAllowed = Boolean(
    gate?.documentReleaseAllowed === true ||
      (ndaSignedValidated && proofOfDepositValidated) ||
      doc.partageDocumentsAutorise === true
  );

  return {
    ndaSignedValidated,
    proofOfDepositValidated,
    documentReleaseAllowed,
  };
}

export interface NylasAccountGateInput {
  nylasEnabled: boolean;
  accountId?: string | null;
  nylasGrantId?: string | null;
  syncStatus?: string | null;
  provider?: string | null;
}

/** Valide l’expéditeur Gmail/Nylas actif (jeton grant). */
export function isNylasSenderReady(account: NylasAccountGateInput | null | undefined): boolean {
  if (!account?.nylasEnabled) return false;
  if (!account.nylasGrantId?.trim()) return false;
  if (account.syncStatus === 'error') return false;
  return account.provider === 'gmail' || account.provider === 'outlook' || Boolean(account.nylasGrantId);
}

export function validateSellerUpdateSendReadiness(input: {
  nylasEnabled: boolean;
  account: NylasAccountGateInput | null | undefined;
  residenceDoc: Record<string, unknown> | null | undefined;
}): SellerUpdateSendReadiness {
  const errors: string[] = [];
  const vendeurEmail = resolveVendeurEmailStrict(input.residenceDoc);

  if (!input.nylasEnabled) {
    errors.push('VITE_NYLAS_ENABLED doit être true en production.');
  }
  if (!input.account) {
    errors.push('Aucun compte expéditeur configuré sur le profil courtier.');
  } else if (!isNylasSenderReady({ ...input.account, nylasEnabled: input.nylasEnabled })) {
    errors.push(
      'Le compte Gmail doit être relié à Nylas (grant actif, statut connected).'
    );
  }
  if (!vendeurEmail) {
    errors.push('Le champ racine vendeurEmail est requis sur la résidence.');
  }

  return {
    ready: errors.length === 0,
    errors,
    vendeurEmail,
  };
}
