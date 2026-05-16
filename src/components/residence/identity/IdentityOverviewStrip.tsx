import React from 'react';
import type { IdentityViewModel } from '@primexpert/core/identity';
import { Building2, MapPin, BedDouble, Tag } from 'lucide-react';

export interface IdentityOverviewStripProps {
  overview: IdentityViewModel['overview'];
  language: 'fr' | 'en';
}

function Tile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-0">
      <div className="flex items-center gap-2 text-slate-500 mb-1">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="text-sm font-bold text-[#000000] leading-snug break-words">{value ?? '—'}</p>
    </div>
  );
}

export function IdentityOverviewStrip({ overview, language }: IdentityOverviewStripProps) {
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile
        label={t('Nom', 'Name')}
        value={overview.name}
        icon={<Building2 className="h-3.5 w-3.5" />}
      />
      <Tile
        label={t('Type / catégorie', 'Type / category')}
        value={overview.typeCategory}
        icon={<Tag className="h-3.5 w-3.5" />}
      />
      <Tile
        label={t('Unités', 'Units')}
        value={overview.unitsLabel}
        icon={<BedDouble className="h-3.5 w-3.5" />}
      />
      <Tile
        label={t('Région & adresse', 'Region & address')}
        value={[overview.region, overview.address].filter(Boolean).join(' · ') || null}
        icon={<MapPin className="h-3.5 w-3.5" />}
      />
    </div>
  );
}
