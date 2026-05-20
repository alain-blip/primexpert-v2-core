import { useMemo } from 'react';
import { buildPublicListing } from '@primexpert/core/diffusion';
import { useLanguage } from '../../../lib/i18n';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { parseSyndicationMeta } from '../../../lib/diffusionSyndication';

const PREVIEW_PUBLIC_ID = '00000000-0000-4000-8000-000000000001';

export function PublicPreviewPanel() {
  const { t } = useLanguage();
  const { residenceDoc } = useResidenceDocument();

  const listing = useMemo(() => {
    if (!residenceDoc) return null;
    try {
      return buildPublicListing(
        residenceDoc as Parameters<typeof buildPublicListing>[0],
        PREVIEW_PUBLIC_ID,
        { visibility: 'MASQUE' as const }
      );
    } catch {
      return null;
    }
  }, [residenceDoc]);

  if (!listing) {
    return (
      <p className="text-[15px] font-semibold text-slate-600">
        {t('Aperçu indisponible.', 'Preview unavailable.')}
      </p>
    );
  }

  const meta = parseSyndicationMeta(residenceDoc ?? undefined);

  return (
    <article className="rounded-xl border-2 border-emerald-800 bg-emerald-50/90 p-6 space-y-4">
      <p className="text-[14px] font-black uppercase tracking-wider text-emerald-900">
        {t('Aperçu acheteur (données anonymisées)', 'Buyer preview (anonymized data)')}
      </p>
      <h3 className="text-[24px] font-black text-primexpert-dark leading-tight">
        {listing.publicTitle ?? t('Titre à définir', 'Title to be set')}
      </h3>
      {listing.publicDescription ? (
        <p className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">
          {listing.publicDescription}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[15px]">
        <PreviewFact label={t('Région', 'Region')} value={listing.region} />
        <PreviewFact label={t('Secteur', 'Sector')} value={listing.secteur} />
        <PreviewFact
          label={t('Fourchette de prix', 'Price range')}
          value={listing.fourchettePrix}
          large
        />
        <PreviewFact
          label={t("Taux d'occupation", 'Occupancy rate')}
          value={
            listing.tauxOccupation != null ? `${listing.tauxOccupation} %` : null
          }
          large
        />
        <PreviewFact label={t('Unités', 'Units')} value={String(listing.nombreUnites)} />
        <PreviewFact label={t('Type', 'Type')} value={listing.residenceType} />
      </ul>
      {meta.rpaAVendre ? (
        <p className="text-[14px] font-bold text-emerald-800">
          {t('Diffusion RPAaVendre.com activée', 'RPAaVendre.com syndication enabled')}
        </p>
      ) : null}
    </article>
  );
}

function PreviewFact({
  label,
  value,
  large,
}: {
  label: string;
  value: string | null;
  large?: boolean;
}) {
  if (!value) return null;
  return (
    <li className="rounded-lg border border-emerald-200 bg-white px-4 py-3">
      <span className="block text-[14px] font-bold text-slate-600">{label}</span>
      <span
        className={
          large
            ? 'block text-[24px] font-black tabular-nums text-primexpert-dark mt-1'
            : 'block text-[16px] font-black text-primexpert-dark mt-1'
        }
      >
        {value}
      </span>
    </li>
  );
}
