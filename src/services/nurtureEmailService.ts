/**
 * File d'attente courriels nurture — Firestore `email_outbox`.
 * Une Cloud Function / extension peut consommer `status: pending` et envoyer via Postmark/SendGrid.
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COMPANY_CONFIG } from '../config/companyConfig';
import type { EmailPayload } from '../config/nurtureEmailTemplates';

export type OutboxEmailKind = 'j7_support_alert' | 'j21_broker_nurture' | 'j30' | 'j40';

export interface OutboxEmailDoc {
  kind: OutboxEmailKind;
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  userId: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: ReturnType<typeof serverTimestamp>;
}

const API_URL = (import.meta.env.VITE_NURTURE_EMAIL_API_URL as string | undefined)?.trim() || '';

async function queueEmail(
  userId: string,
  kind: OutboxEmailKind,
  payload: EmailPayload
): Promise<string> {
  const docRef = await addDoc(collection(db, 'email_outbox'), {
    kind,
    to: payload.to,
    subject: payload.subject,
    textBody: payload.textBody,
    htmlBody: payload.htmlBody,
    userId,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  if (API_URL) {
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outboxId: docRef.id, ...payload, kind, userId }),
      });
    } catch (err) {
      console.warn('[nurtureEmail] API relay failed, outbox doc queued:', err);
    }
  } else if (import.meta.env.DEV) {
    console.info('[nurtureEmail] Queued (sandbox):', kind, payload.subject, '→', payload.to);
  }

  return docRef.id;
}

export async function sendEmailPayload(
  userId: string,
  kind: OutboxEmailKind,
  payload: EmailPayload
): Promise<string> {
  return queueEmail(userId, kind, payload);
}

export function getSupportEmail(): string {
  return COMPANY_CONFIG.supportEmail;
}
