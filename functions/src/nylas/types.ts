/** Payload Nylas v3 (simplifié) — webhook `message.created` / envoi API. */
export interface NylasWebhookEnvelope {
  type?: string;
  data?: {
    object?: NylasMessageObject;
  };
}

export interface NylasMessageObject {
  id?: string;
  grant_id?: string;
  thread_id?: string;
  subject?: string;
  body?: string;
  snippet?: string;
  date?: number;
  unread?: boolean;
  from?: Array<{ name?: string; email?: string }>;
  to?: Array<{ name?: string; email?: string }>;
}

export interface OAuthStatePayload {
  uid: string;
  accountId: string;
  provider: 'gmail' | 'outlook';
  label: string;
  returnUrl: string;
}
