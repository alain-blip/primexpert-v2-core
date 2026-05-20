import { Building2, Home, Layers } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import type { AssetNiche } from '../../../types/residence';
import { isPortalRelevant } from '../../../lib/diffusionSyndication';
import type { ResidenceSyndicationMeta } from '../../../lib/diffusionSyndication';

const CHECKBOX_CLASS =
  'h-6 w-6 shrink-0 accent-[#142c6a] cursor-pointer disabled:cursor-not-allowed';

export interface SyndicationToggleGridProps {
  assetNiche: AssetNiche | undefined;
  meta: ResidenceSyndicationMeta;
  disabled?: boolean;
  onToggle: (portal: 'rpaAVendre' | 'cpeAVendre' | 'plexAVendre', enabled: boolean) => void;
}

const PORTALS: {
  key: 'rpaAVendre' | 'cpeAVendre' | 'plexAVendre';
  niche: AssetNiche;
  labelFr: string;
  labelEn: string;
  domain: string;
  icon: typeof Building2;
}[] = [
  {
    key: 'rpaAVendre',
    niche: 'RPA',
    labelFr: 'Résidence pour aînés (RPA)',
    labelEn: 'Retirement home (RPA)',
    domain: 'RPAaVendre.com',
    icon: Building2,
  },
  {
    key: 'cpeAVendre',
    niche: 'CPE',
    labelFr: "Centre de la petite enfance (CPE)",
    labelEn: 'Childcare centre (CPE)',
    domain: 'CPEaVendre.com',
    icon: Home,
  },
  {
    key: 'plexAVendre',
    niche: 'PLEX',
    labelFr: 'Immeuble à revenus (Plex)',
    labelEn: 'Income property (Plex)',
    domain: 'PlexaVendre.com',
    icon: Layers,
  },
];

export function SyndicationToggleGrid({
  assetNiche,
  meta,
  disabled,
  onToggle,
}: SyndicationToggleGridProps) {
  const { t, language } = useLanguage();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {PORTALS.map((portal) => {
        const relevant = isPortalRelevant(assetNiche, portal.niche);
        const checked = meta[portal.key] === true;
        const Icon = portal.icon;
        const title = language === 'fr' ? portal.labelFr : portal.labelEn;

        return (
          <label
            key={portal.key}
            className={cn(
              'flex min-h-[140px] flex-col rounded-xl border-4 px-5 py-5 transition',
              relevant
                ? checked
                  ? 'border-emerald-700 bg-emerald-50 cursor-pointer'
                  : 'border-primexpert-dark bg-white hover:bg-slate-50 cursor-pointer'
                : 'border-slate-300 bg-slate-100 cursor-not-allowed opacity-80'
            )}
          >
            <span className="flex items-start gap-3 mb-3">
              <Icon className="h-8 w-8 text-primexpert-dark shrink-0" aria-hidden />
              <span className="min-w-0 block">
                <span className="block text-[16px] font-black text-primexpert-dark leading-snug">
                  {title}
                </span>
                <span className="block text-[14px] font-bold text-slate-600 mt-1">
                  {portal.domain}
                </span>
              </span>
            </span>
            {relevant ? (
              <span className="mt-auto flex items-center gap-3">
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => onToggle(portal.key, e.target.checked)}
                />
                <span className="text-[15px] font-black uppercase text-primexpert-dark">
                  {checked
                    ? t('Syndication active', 'Syndication on')
                    : t('Syndication inactive', 'Syndication off')}
                </span>
              </span>
            ) : (
              <p className="mt-auto text-[15px] font-black uppercase text-slate-500">
                {t('Non pertinent (catégorie)', 'Not relevant (category)')}
              </p>
            )}
          </label>
        );
      })}
    </div>
  );
}
