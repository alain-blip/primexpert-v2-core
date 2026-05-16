/**
 * File d'attente locale pour créer des contacts CRM depuis la Mailbox (Phase E-2).
 * Pas de duplication Firestore tant que le CRM n'est pas persisté.
 */

import type { AssetNiche } from '../types/residence';

export const CRM_INBOUND_QUEUE_KEY = 'primexpert_crm_draft_queue';

export interface CrmInboundDraft {
  name: string;
  email: string;
  phone: string;
  type: string;
  status: string;
  notes: string;
  sourceMessageId: string;
  /** Profils investisseur (traversant RPA / CPE / Plex). */
  investorProfiles?: AssetNiche[];
  /** Absent ou `global` = répertoire partagé ; sinon fiche cloisonnée à ce silo uniquement. */
  contactSiloScope?: 'global' | AssetNiche;
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
