/**
 * Priorités de suivi — séquence serrée J+3 / J+5 / J+7 (KISS, 3 lignes max).
 */

import React, { useMemo } from 'react';
import { useLanguage } from '../../lib/i18n';
import { useWorkhubNav } from '../../lib/workhubNav';
import { stashListingsFocusResidenceId } from '../../lib/listingsFocus';
import type { DashboardPriorityFollowUpItem } from '../../services/dashboardPriorityFollowUp';
import { groupDashboardPrioritiesByDate } from '../../services/dashboardPriorityFollowUp';

const MAIL_DRAFT_KEY = 'primexpert.mail.composeDraft';

export interface PriorityFollowUpListProps {
  items: DashboardPriorityFollowUpItem[];
  loading?: boolean;
}

function stashMailDraft(body: string, toEmail?: string | null) {
  try {
    sessionStorage.setItem(
      MAIL_DRAFT_KEY,
      JSON.stringify({ body, toEmail: toEmail ?? undefined, at: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

function PriorityRow({
  item,
  onOpenResidence,
  onOpenPhone,
  onOpenMail,
  onOpenOffer,
  t,
}: {
  item: DashboardPriorityFollowUpItem;
  onOpenResidence: (id: string) => void;
  onOpenPhone: (phone: string | null) => void;
  onOpenMail: (item: DashboardPriorityFollowUpItem) => void;
  onOpenOffer: (id: string) => void;
  t: (fr: string, en: string) => string;
}) {
  const companySuffix = item.buyerCompany ? ` (${item.buyerCompany})` : '';

  return (
    <li className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-2">
      <p className="text-sm text-[#000000] leading-snug">
        <span className="font-semibold">{item.title}</span>
        {' — '}
        {t('Acheteur', 'Buyer')}:{' '}
        <button
          type="button"
          onClick={() => onOpenMail(item)}
          className="font-semibold underline underline-offset-2 hover:text-slate-700"
        >
          {item.buyerFullName}
          {companySuffix}
        </button>
        {' | '}
        {t('Propriété', 'Property')}:{' '}
        <button
          type="button"
          onClick={() => onOpenResidence(item.residenceId)}
          className="font-semibold underline underline-offset-2 hover:text-slate-700"
        >
          {item.propertyName}
        </button>
      </p>
      <p className="text-sm text-[#000000] leading-relaxed">
        <span className="font-semibold">{t('Action', 'Action')}:</span> {item.actionText}
      </p>
      <p className="text-sm text-[#000000] flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenPhone(item.buyerPhone)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold hover:border-slate-300 transition"
        >
          [ 📞 {t('Appeler', 'Call')} ]
        </button>
        {item.step === 'j7' ? (
          <button
            type="button"
            onClick={() => onOpenOffer(item.residenceId)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold hover:border-slate-300 transition"
          >
            [ 📄 {t('Offre / LOI', 'Offer / LOI')} ]
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenMail(item)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold hover:border-slate-300 transition"
          >
            [ 🔎 {t('Envoyer un courriel', 'Send an email')} ]
          </button>
        )}
      </p>
    </li>
  );
}

export function PriorityFollowUpList({ items, loading }: PriorityFollowUpListProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
  const workhubNav = useWorkhubNav();

  const groups = useMemo(
    () => groupDashboardPrioritiesByDate(items, locale),
    [items, locale]
  );

  const openResidence = (residenceId: string) => {
    stashListingsFocusResidenceId(residenceId);
    workhubNav?.setActiveTab('listings');
  };

  const openPhone = (phone: string | null) => {
    if (phone) {
      try {
        sessionStorage.setItem('primexpert.phone.dial', phone);
      } catch {
        /* ignore */
      }
    }
    workhubNav?.setActiveTab('phone');
  };

  const openMail = (row: DashboardPriorityFollowUpItem) => {
    stashMailDraft(row.actionText, row.buyerEmail);
    workhubNav?.setActiveTab('mail');
  };

  const openOffer = (residenceId: string) => {
    stashListingsFocusResidenceId(residenceId);
    workhubNav?.setActiveTab('listings');
  };

  if (loading) {
    return (
      <p className="text-sm text-[#000000] py-4">{t('Chargement…', 'Loading…')}</p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[#000000] py-2 leading-relaxed">
        {t(
          'Aucun suivi J+3 / J+5 / J+7 actif. Les priorités apparaissent après la date de libération documentaire sur une inscription.',
          'No active D+3 / D+5 / D+7 follow-ups. Priorities appear after the document release date is set on a listing.'
        )}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.dateKey}>
          <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-[#000000] mb-3 capitalize">
            {group.dateLabel}
          </h4>
          <ul className="space-y-3">
            {group.items.map((item) => (
              <PriorityRow
                key={item.id}
                item={item}
                onOpenResidence={openResidence}
                onOpenPhone={openPhone}
                onOpenMail={openMail}
                onOpenOffer={openOffer}
                t={t}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
