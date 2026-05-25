/**
 * Panneau « Historique intelligent » — agrège E-3 (appels) et E-2 (courriels matchés)
 * pour une résidence donnée (vue 360° « Mes inscriptions »).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { parsePartiesImpliquees } from '@primexpert/core/residence';
import type { UnifiedTimelineEvent } from '@primexpert/core/intelligence';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';
import type { Residence } from '../services/residences';
import {
  subscribeCallAnalysesForResidence,
  type CallAnalysisRow,
} from '../services/transcriptionService';
import {
  subscribeMailboxAnalysesForResidence,
  type SavedMailboxAnalysis,
} from '../services/mailboxAnalysis';
import { fetchResidenceDoc } from '../services/sellerUpdateDelivery';
import {
  getOrganizationContactById,
  type ContactServiceContext,
} from '../services/contacts';
import {
  buildResidencePartiesTimeline,
  fetchPartySupplementMails,
} from '../services/communicationTimelineService';
import { inst, InstitutionalPageHeader } from './residence/institutional/InstitutionalUi';
import { SellerWeeklyReportModule } from './intelligence/SellerWeeklyReportModule';
import { IntelligenceChronologie } from './intelligence/IntelligenceChronologie';

export interface ResidenceIntelligencePanelProps {
  brokerId: string;
  residence: Residence;
  onClose: () => void;
  /** Intégré dans ResidenceDetail : masque retour + en-tête dupliqué. */
  embedded?: boolean;
}

export function ResidenceIntelligencePanel({
  brokerId,
  residence,
  onClose,
  embedded = false,
}: ResidenceIntelligencePanelProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [calls, setCalls] = useState<CallAnalysisRow[]>([]);
  const [mails, setMails] = useState<SavedMailboxAnalysis[]>([]);
  const [subError, setSubError] = useState<string | null>(null);
  const [residenceDoc, setResidenceDoc] = useState<Record<string, unknown> | null>(null);
  const [partiesTimelineEvents, setPartiesTimelineEvents] = useState<UnifiedTimelineEvent[]>(
    []
  );

  const contactCtx: ContactServiceContext | null = useMemo(() => {
    if (!profile?.uid || !profile.orgId) return null;
    return { uid: profile.uid, orgId: profile.orgId, role: profile.role };
  }, [profile?.uid, profile?.orgId, profile?.role]);

  useEffect(() => {
    if (!brokerId || !residence.id) return;
    setSubError(null);
    const unsubCalls = subscribeCallAnalysesForResidence(
      brokerId,
      residence.id,
      setCalls,
      (e) => setSubError(e.message)
    );
    const unsubMails = subscribeMailboxAnalysesForResidence(
      brokerId,
      residence.id,
      setMails,
      (e) => setSubError((prev) => prev ?? e.message)
    );
    return () => {
      unsubCalls();
      unsubMails();
    };
  }, [brokerId, residence.id]);

  useEffect(() => {
    let cancelled = false;
    void fetchResidenceDoc(residence.id).then((doc) => {
      if (!cancelled) setResidenceDoc(doc);
    });
    return () => {
      cancelled = true;
    };
  }, [residence.id]);

  useEffect(() => {
    if (!brokerId || !residence.id) {
      setPartiesTimelineEvents([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      const doc = residenceDoc ?? (await fetchResidenceDoc(residence.id));
      const parties = parsePartiesImpliquees(doc);
      const partyEmails: string[] = [];

      if (contactCtx) {
        for (const partie of parties) {
          try {
            const contact = await getOrganizationContactById(contactCtx, partie.contactId);
            const email = contact?.email?.trim();
            if (email) partyEmails.push(email);
          } catch {
            /* contact introuvable — ignorer */
          }
        }
      }

      const excludeMessageIds = new Set(mails.map((m) => m.messageId));
      const supplementMails =
        partyEmails.length > 0
          ? await fetchPartySupplementMails(brokerId, partyEmails, excludeMessageIds)
          : [];

      if (cancelled) return;

      setPartiesTimelineEvents(
        buildResidencePartiesTimeline(
          residence.id,
          partyEmails,
          mails,
          supplementMails,
          calls
        )
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [brokerId, residence.id, residenceDoc, calls, mails, contactCtx]);

  const addrTitle = residence.city ? `${residence.address}, ${residence.city}` : residence.address;

  return (
    <div className={cn('space-y-5', !embedded && inst.page)}>
      {!embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-[#142c6a] transition"
              aria-label={t('Retour à mes inscriptions', 'Back to my listings')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <InstitutionalPageHeader
                title={t('Vue 360° · Intelligence centralisée', '360° view · Centralized intelligence')}
              />
              <h2 className="text-xl font-black text-[#142c6a] tracking-tight truncate -mt-2">{addrTitle}</h2>
            </div>
          </div>
        </div>
      ) : null}

      {subError && (
        <div className={inst.alertAmber}>
          {t(
            'Abonnement Firestore : vérifie les règles déployées et crée l’index composite si la console le demande.',
            'Firestore subscription: deploy rules and create the composite index if the console prompts you.'
          )}{' '}
          <span className="font-mono text-slate-600">({subError})</span>
        </div>
      )}

      <SellerWeeklyReportModule
        brokerId={brokerId}
        residence={residence}
        calls={calls}
        mails={mails}
      />

      <IntelligenceChronologie
        brokerId={brokerId}
        residence={residence}
        calls={calls}
        mails={mails}
        timelineEvents={partiesTimelineEvents}
      />
    </div>
  );
}
