/**
 * Carte inscription — coupe-feu institutionnel (Mes inscriptions).
 * Nom en tête · bandeau statut · métriques financières + SUGGESTION IA.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { buildListingCardViewModel } from '../lib/listingCardViewModel';
import type { Residence } from '../services/residences';
import type { RadarPropertyType } from '../lib/radarAccess';
import { RadarLockBadge } from './RadarLockBadge';
const BADGE_SUGGESTION =
  'inline-block w-fit px-3 py-1 bg-amber-100 text-amber-950 border-2 border-amber-400 text-[11px] font-black tracking-wide uppercase rounded';

function FinancialMetrics({
  commissionRate,
  potentialRevenue,
}: {
  commissionRate: string;
  potentialRevenue: string;
}) {
  return (
    <div className="mb-3 rounded-lg bg-primexpert-light px-3 py-2 text-[14px] font-bold leading-snug text-black">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Comm : {commissionRate}%</span>
        <span>Revenu Pot. : {potentialRevenue}</span>
      </div>
    </div>
  );
}

export interface ListingInstitutionalCardProps {
  residence: Residence;
  onOpen: (r: Residence) => void;
  stale?: boolean;
  t: (fr: string, en: string) => string;
  language: 'fr' | 'en';
  isLocked?: boolean;
  propertyType?: RadarPropertyType;
  onLockedClick?: (propertyType: RadarPropertyType) => void;
  className?: string;
}

function SuggestionBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2 text-[#142c6a]">
      <span className={BADGE_SUGGESTION}>{label}</span>
      <p className="text-[13px] font-semibold leading-relaxed">{children}</p>
    </div>
  );
}

export function ListingInstitutionalCard({
  residence,
  onOpen,
  stale,
  t,
  language,
  isLocked = false,
  propertyType,
  onLockedClick,
  className,
}: ListingInstitutionalCardProps) {
  const vm = buildListingCardViewModel(residence, {
    language: language === 'fr' ? 'fr' : 'en',
  });

  const handleClick = () => {
    if (isLocked && propertyType && onLockedClick) {
      onLockedClick(propertyType);
      return;
    }
    onOpen(residence);
  };

  return (
    <article
      className={cn(
        'block w-full text-left bg-white border-2 rounded-xl shadow-2xl overflow-hidden border-l-[8px] mb-2.5',
        vm.borderShellClass,
        isLocked && 'opacity-80',
        className
      )}
    >
      <div className={cn('p-2.5 pb-2', vm.headerTintClass)}>
        {isLocked && propertyType ? (
          <div className="mb-2">
            <RadarLockBadge propertyType={propertyType} locale={language} />
          </div>
        ) : null}
        {stale && !isLocked ? (
          <p className="mb-2 flex items-center gap-1.5 rounded border border-amber-400 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-primexpert-dark">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
            {t('Stagnation 48 h+', '48h+ stagnation')}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'block w-full text-left text-[15px] font-black text-[#142c6a] uppercase tracking-wide truncate',
            'underline underline-offset-2 decoration-primexpert-dark/40 hover:decoration-primexpert-dark',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primexpert-gold rounded-sm',
            isLocked && 'select-none blur-[5px] pointer-events-none'
          )}
        >
          {vm.residenceName}
        </button>
        <span className={cn('text-[16px] font-black text-black block mt-0.5', isLocked && 'select-none blur-[4px]')}>
          {vm.askingPriceLabel}
        </span>
        <span className={cn('text-[12px] text-slate-600 font-medium block mt-0.5 truncate', isLocked && 'select-none blur-[4px]')}>
          {vm.addressLine}
        </span>

        <div className={cn(vm.statusBannerClass, 'my-1')}>{vm.statusBannerLabel}</div>
      </div>

      <div className="w-full p-2.5 pt-1.5">
        <FinancialMetrics
          commissionRate={vm.commissionRateLabel}
          potentialRevenue={vm.potentialRevenueLabel}
        />
        <SuggestionBlock label={t('SUGGESTION IA', 'AI SUGGESTION')}>
          {vm.suggestionIA}
        </SuggestionBlock>
      </div>
    </article>
  );
}
