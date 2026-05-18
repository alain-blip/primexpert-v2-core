/**
 * Envoi relance acheteur J+5 — Nylas production (destinataire = courriel acheteur actif).
 */

import { isNylasSenderReady } from '@primexpert/core/intelligence';
import type { EmailAccountConfig } from '../types/emailAccount';
import { isNylasConfigured, sendSellerUpdateViaNylas } from './nylasClient';

export function checkBuyerRelanceSendReadiness(input: {
  account: EmailAccountConfig | null;
  buyerEmail: string | null;
}): { ready: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isNylasConfigured()) {
    errors.push('VITE_NYLAS_ENABLED=true requis pour l’envoi en production.');
  }
  if (
    !input.account ||
    !isNylasSenderReady({
      nylasEnabled: isNylasConfigured(),
      accountId: input.account.id,
      nylasGrantId: input.account.nylasGrantId,
      syncStatus: input.account.syncStatus,
      provider: input.account.provider,
    })
  ) {
    errors.push(
      'Le compte Gmail doit être relié à Nylas (grant actif, statut connected).'
    );
  }
  const email = input.buyerEmail?.trim();
  if (!email?.includes('@')) {
    errors.push('Courriel acheteur requis (analyse courriel matchée à la résidence).');
  }
  return { ready: errors.length === 0, errors };
}

export async function deliverBuyerRelanceEmail(input: {
  residenceId: string;
  residenceLabel: string;
  body: string;
  buyerEmail: string;
  buyerName?: string;
  account: EmailAccountConfig;
  subject?: string;
}): Promise<{ channel: 'nylas'; threadId: string }> {
  const readiness = checkBuyerRelanceSendReadiness({
    account: input.account,
    buyerEmail: input.buyerEmail,
  });
  if (!readiness.ready) {
    throw new Error(readiness.errors.join(' '));
  }

  const subject =
    input.subject?.trim() ||
    `Suivi dossier — ${input.residenceLabel}`.slice(0, 120);

  const { threadId } = await sendSellerUpdateViaNylas({
    toEmail: input.buyerEmail.trim(),
    toName: input.buyerName,
    subject,
    body: input.body,
    accountId: input.account.id,
    propertyId: input.residenceId,
    propertyLabel: input.residenceLabel,
  });

  return { channel: 'nylas', threadId };
}
