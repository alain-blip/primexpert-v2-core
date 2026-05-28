/**
 * Priorités de suivi — séquence serrée J+3 / J+5 / J+7 (KISS, 3 lignes max).
 */

import React, { useMemo } from 'react';
import { useLanguage } from '../../lib/i18n';
import { useWorkhubNav } from '../../lib/workhubNav';
import { stashListingsFocusResidenceId } from '../../lib/listingsFocus';
import {
  institutionalInkTextClass,
  institutionalPrimaryButtonClass,
  institutionalWhiteCardCompactClass,
} from '../../lib/institutionalTheme';
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
  const kindBadge =
    item.briefingKind === 'hot_lead'
      ? t('Piste chaude', 'Hot lead')
      : item.briefingKind === 'certification'
        ? t('Certification', 'Certification')
        : null;

  return (
    <li className={institutionalWhiteCardCompactClass}>
      <p className={`text-sm ${institutionalInkTextClass} leading-snug font-semibold`}>
        <span className="font-black">{item.title}</span>
        {' — '}
        {t('Acheteur', 'Buyer')}:{' '}
        <button
          type="button"
          onClick={() => onOpenMail(item)}
          className="font-semibold underline underline-offset-2 hover:text-[#142c6a]/70"
        >
          {item.buyerFullName}
          {companySuffix}
        </button>
        {' | '}
        {t('Propriété', 'Property')}:{' '}
        <button
          type="button"
          onClick={() => onOpenResidence(item.residenceId)}
          className="font-semibold underline underline-offset-2 hover:text-[#142c6a]/70"
        >
          {item.propertyName}
        </button>
      </p>
      <p className={`text-sm ${institutionalInkTextClass} leading-relaxed`}>
        {kindBadge ? (
          <span className="mr-2 rounded-md border border-[#142c6a]/25 bg-[#142c6a]/5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#142c6a]">
            {kindBadge}
          </span>
        ) : null}
        {item.step === 'pa_inspection' || item.step === 'pa_financement' ? (
          item.actionText
        ) : (
          <>
            <span className="font-black text-[10px] uppercase tracking-wider">
              {t('Action', 'Action')}
            </span>{' '}
            {item.actionText}
          </>
        )}
      </p>
      <p className={`text-sm ${institutionalInkTextClass} flex flex-wrap gap-2`}>
        <button
          type="button"
          onClick={() => onOpenPhone(item.buyerPhone)}
          className={institutionalPrimaryButtonClass}
        >
          [ 📞 {t('Appeler', 'Call')} ]
        </button>
        {item.step === 'j7' ? (
          <button
            type="button"
            onClick={() => onOpenOffer(item.residenceId)}
            className={institutionalPrimaryButtonClass}
          >
            [ 📄 {t('Offre / LOI', 'Offer / LOI')} ]
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenMail(item)}
            className={institutionalPrimaryButtonClass}
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
      <p className={`text-sm ${institutionalInkTextClass} py-4 font-semibold text-white`}>
        {t('Chargement…', 'Loading…')}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-white/90 py-2 leading-relaxed bg-white/10 border-2 border-white/20 rounded-xl p-5">
        {t(
          'Aucune priorité active (J+3 / J+5 / J+7 ou échéances PA à 48 h).',
          'No active priorities (D+3 / D+5 / D+7 or PA deadlines within 48 h).'
        )}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.dateKey}>
          <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-white mb-3 capitalize">
            {group.dateLabel}
          </h4>
          <ul className="space-y-3 m-0 p-0 list-none">
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
