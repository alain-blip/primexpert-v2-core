import React from 'react';
import { Lock } from 'lucide-react';
import { upsellExtensionLabel, type RadarPropertyType } from '../lib/radarAccess';

interface RadarLockBadgeProps {
  propertyType: RadarPropertyType;
  locale: 'fr' | 'en';
}

/** Badge extension manquante (Plex / Commercial). */
export function RadarLockBadge({ propertyType, locale }: RadarLockBadgeProps) {
  const label = upsellExtensionLabel(propertyType, locale);
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[#FACC15]/45 bg-[#FACC15]/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-[#FACC15]">
      <Lock className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
