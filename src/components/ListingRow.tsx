import React from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import type { Residence, ResidenceStatus } from '../services/residences';

const STATUS_BADGE: Record<
  ResidenceStatus,
  { fr: string; en: string; className: string }
> = {
  prospect: {
    fr: 'Prospection',
    en: 'Prospect',
    className: 'border-orange-400/35 bg-orange-500/15 text-orange-200',
  },
  mandate: {
    fr: 'Mandat',
    en: 'Mandate',
    className: 'border-blue-400/35 bg-blue-500/15 text-blue-200',
  },
  promise: {
    fr: 'Promesse',
    en: 'Promise',
    className: 'border-amber-400/35 bg-amber-500/15 text-amber-200',
  },
  expired: {
    fr: 'Expiré',
    en: 'Expired',
    className: 'border-red-400/35 bg-red-500/15 text-red-200',
  },
  unsigned: {
    fr: 'Non signé',
    en: 'Unsigned',
    className: 'border-white/15 bg-white/[0.06] text-slate-300',
  },
  sold: {
    fr: 'Vendu',
    en: 'Sold',
    className: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200',
  },
};

export interface ListingRowProps {
  residence: Residence;
  onOpen: (r: Residence) => void;
  stale?: boolean;
  t: (fr: string, en: string) => string;
  language: 'fr' | 'en';
}

export function ListingRow({ residence, onOpen, stale, t, language }: ListingRowProps) {
  const badge = STATUS_BADGE[residence.status] ?? STATUS_BADGE.prospect;
  const line =
    residence.city?.trim() && residence.city !== '—'
      ? `${residence.address}, ${residence.city}`
      : residence.address;

  return (
    <button
      type="button"
      onClick={() => onOpen(residence)}
      className={cn(
        'flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-2.5 text-left',
        'hover:bg-blue-500/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400/60 transition-colors'
      )}
    >
      <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[12px] font-black text-slate-100">{line}</p>
                  {residence.assetNiche ? (
                    <span className="shrink-0 rounded border border-violet-400/30 bg-violet-500/15 px-1.5 py-0.5 font-mono text-[8px] font-black text-violet-200">
                      {residence.assetNiche}
                    </span>
                  ) : null}
          {stale ? (
            <span title={t('Stagnation 48 h+', '48h+ stagnation')}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
          {formatCurrency(residence.price)} · {residence.id}
        </p>
      </div>
      <span
        className={cn(
          'hidden shrink-0 rounded-lg border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest sm:inline',
          badge.className
        )}
      >
        {language === 'fr' ? badge.fr : badge.en}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
    </button>
  );
}
