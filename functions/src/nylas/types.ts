/** Payload Nylas v3 — webhook `message.opened` (tracking). */
export interface NylasMessageOpenedObject {
  object?: string;
  grant_id?: string;
  message_id?: string;
  label?: string;
  message_data?: { count?: number; timestamp?: number };
  recents?: Array<{ timestamp?: number; ip?: string; user_agent?: string }>;
  timestamp?: number;
}

/** Payload Nylas v3 (simplifié) — webhooks message.* / tracking. */
export interface NylasWebhookEnvelope {
  type?: string;
  data?: {
    grant_id?: string;
    object?: NylasMessageObject | NylasMessageOpenedObject;
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
  /** Libellés / dossiers Nylas (ex. INBOX, SENT, TRASH). */
  folders?: string[];
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
