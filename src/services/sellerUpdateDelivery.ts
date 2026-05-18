/**
 * Expédition mise à jour vendeur — Nylas production uniquement (pas de repli messagerie).
 */

import { doc, getDoc } from 'firebase/firestore';
import {
  resolveVendeurEmailStrict,
  validateSellerUpdateSendReadiness,
  type SellerUpdateSendReadiness,
} from '@primexpert/core/intelligence';
import { db } from '../lib/firebase';
import { isNylasConfigured, sendSellerUpdateViaNylas } from './nylasClient';
import type { EmailAccountConfig } from '../types/emailAccount';

export async function fetchResidenceDoc(
  residenceId: string
): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'residences', residenceId));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function fetchResidenceVendorEmail(
  residenceId: string
): Promise<string | null> {
  const data = await fetchResidenceDoc(residenceId);
  return resolveVendeurEmailStrict(data);
}

export function checkSellerUpdateSendReadiness(input: {
  account: EmailAccountConfig | null;
  residenceDoc: Record<string, unknown> | null;
}): SellerUpdateSendReadiness {
  return validateSellerUpdateSendReadiness({
    nylasEnabled: isNylasConfigured(),
    account: input.account
      ? {
          nylasEnabled: isNylasConfigured(),
          accountId: input.account.id,
          nylasGrantId: input.account.nylasGrantId,
          syncStatus: input.account.syncStatus,
          provider: input.account.provider,
        }
      : null,
    residenceDoc: input.residenceDoc,
  });
}

export async function deliverSellerUpdateEmail(input: {
  residenceId: string;
  residenceLabel: string;
  body: string;
  subject?: string;
  account: EmailAccountConfig;
  residenceDoc: Record<string, unknown> | null;
}): Promise<{ channel: 'nylas'; threadId: string }> {
  const readiness = checkSellerUpdateSendReadiness({
    account: input.account,
    residenceDoc: input.residenceDoc,
  });

  if (!readiness.ready || !readiness.vendeurEmail) {
    throw new Error(readiness.errors.join(' '));
  }

  if (!isNylasConfigured()) {
    throw new Error('VITE_NYLAS_ENABLED=true requis pour l’envoi en production.');
  }

  if (!input.account.nylasGrantId?.trim()) {
    throw new Error(
      'Compte Gmail non relié à Nylas. Reconnectez la boîte dans Paramètres.'
    );
  }

  const subject =
    input.subject?.trim() ||
    `Mise à jour — ${input.residenceLabel}`.slice(0, 120);

  const { threadId } = await sendSellerUpdateViaNylas({
    toEmail: readiness.vendeurEmail,
    subject,
    body: input.body,
    accountId: input.account.id,
    propertyId: input.residenceId,
    propertyLabel: input.residenceLabel,
  });

  return { channel: 'nylas', threadId };
}
