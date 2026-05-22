import React from 'react';
import {
  deriveBuyerTier,
  formatBuyerTierLabel,
  type BuyerCommercialTier,
  type OrganizationContact,
} from '@primexpert/core/crm';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';

const TIER_STYLES: Record<BuyerCommercialTier, string> = {
  PRIVILEGED:
    'bg-emerald-100 text-emerald-950 border-emerald-600',
  QUALIFIED:
    'bg-sky-100 text-sky-950 border-sky-600',
};

export interface BuyerTierBadgeProps {
  contact: Pick<OrganizationContact, 'relationRoles' | 'buyerCriteria'>;
  /** Aperçu temps réel (formulaire) — critères non encore persistés. */
  previewCriteria?: OrganizationContact['buyerCriteria'];
  previewRoles?: OrganizationContact['relationRoles'];
  className?: string;
}

export function BuyerTierBadge({
  contact,
  previewCriteria,
  previewRoles,
  className,
}: BuyerTierBadgeProps) {
  const { language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const tier = deriveBuyerTier({
    relationRoles: previewRoles ?? contact.relationRoles,
    buyerCriteria: previewCriteria ?? contact.buyerCriteria,
  });
  if (!tier) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border-2 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest',
        TIER_STYLES[tier],
        className
      )}
    >
      {formatBuyerTierLabel(tier, lang)}
    </span>
  );
}
