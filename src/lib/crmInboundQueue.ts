/**
 * File d'attente locale pour créer des contacts CRM depuis la Mailbox (Phase E-2).
 * Pas de duplication Firestore tant que le CRM n'est pas persisté.
 */

export const CRM_INBOUND_QUEUE_KEY = 'primexpert_crm_draft_queue';

export interface CrmInboundDraft {
  name: string;
  email: string;
  phone: string;
  type: string;
  status: string;
  notes: string;
  sourceMessageId: string;
}

export function appendCrmInboundDraft(draft: CrmInboundDraft): void {
  try {
    const raw = sessionStorage.getItem(CRM_INBOUND_QUEUE_KEY);
    const q = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(q) ? q : [];
    list.push(draft);
    sessionStorage.setItem(CRM_INBOUND_QUEUE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('[crmInboundQueue] append failed', e);
  }
}
