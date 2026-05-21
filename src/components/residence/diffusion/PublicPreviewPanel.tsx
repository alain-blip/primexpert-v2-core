import { useMemo } from 'react';
import {
  buildPublicListing,
  extractBuyerPreviewKpis,
  formatPublicListingHeadline,
  PUBLIC_BUYER_CONTRACTS_HTML,
  PUBLIC_LEGAL_NO_WARRANTY_EN,
  PUBLIC_LEGAL_NO_WARRANTY_FR,
} from '@primexpert/core/diffusion';
import { useLanguage } from '../../../lib/i18n';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { useFinancialData } from '../../../context/FinancialDataContext';
import { parseSyndicationMeta } from '../../../lib/diffusionSyndication';
import { formatCurrency } from '../../../lib/utils';

const PREVIEW_PUBLIC_ID = '00000000-0000-4000-8000-000000000001';

/** Boutons or portail — une ligne (flex-row), inactifs en aperçu CRM. */
const GOLD_BTN =
  'flex-1 min-w-0 min-h-[48px] rounded-lg border-2 border-black/25 bg-[#D4AF37] px-2 py-2.5 text-[12px] sm:text-[13px] font-black text-black text-center cursor-default leading-tight';

export interface PublicPreviewPanelProps {
  /** Affiche le bloc contrats à charge de l'acheteur (comme sur WordPress). */
  showBuyerContracts?: boolean;
  /** Mise en page pleine largeur type portail RPAaVendre.com (modal brouillon). */
  variant?: 'inline' | 'portal';
}

function pickString(doc: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!doc) return '';
  for (const key of keys) {
    const v = doc[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function PublicPreviewPanel({
  showBuyerContracts = false,
  variant = 'inline',
}: PublicPreviewPanelProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { residenceDoc } = useResidenceDocument();
  const { financialData, loading: financeLoading } = useFinancialData();

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

  const headline = useMemo(
    () => (listing ? formatPublicListingHeadline(listing.fourchetteUnites, locale) : ''),
    [listing, locale]
  );

  const kpis = useMemo(
    () => extractBuyerPreviewKpis(financialData?.calculatedResults),
    [financialData]
  );

  const fmt = (n: number | null) =>
    n != null && Number.isFinite(n) ? formatCurrency(n, { maxDecimals: 0 }) : '—';

  const legalDisclaimer =
    language === 'fr' ? PUBLIC_LEGAL_NO_WARRANTY_FR : PUBLIC_LEGAL_NO_WARRANTY_EN;

  const sections = useMemo(() => {
    const doc = residenceDoc as Record<string, unknown> | undefined;
    return {
      building: pickString(
        doc,
        'publicCaracteristiquesBatiment',
        'publicBuildingCharacteristics',
        'caracteristiquesBatimentPublic'
      ),
      services: pickString(
        doc,
        'publicServicesEtConditions',
        'publicServicesConditions',
        'servicesEtConditionsPublic'
      ),
      health: pickString(
        doc,
        'publicSoinsSanteOfferts',
        'publicHealthCareServices',
        'soinsSanteOffertsPublic'
      ),
    };
  }, [residenceDoc]);

  if (!listing) {
    return (
      <p className="text-[15px] font-semibold text-slate-600">
        {t('Aperçu indisponible.', 'Preview unavailable.')}
      </p>
    );
  }

  const meta = parseSyndicationMeta(residenceDoc ?? undefined);
  const isPortal = variant === 'portal';

  return (
    <article
      className={
        isPortal
          ? 'overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg'
          : 'rounded-xl border-2 border-emerald-800 bg-emerald-50/90 overflow-hidden'
      }
    >
      <div className="relative w-full bg-primexpert-blue">
        {listing.publicVisualUrl ? (
          <img
            src={listing.publicVisualUrl}
            alt=""
            className="w-full h-[220px] object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-[220px] w-full items-center justify-center px-6 text-center">
            <p className="text-[14px] font-black uppercase tracking-wider text-white/90">
              {t('Image générique — catégorie', 'Generic image — category')}{' '}
              {listing.categorieVisuelle}
            </p>
          </div>
        )}
        {!isPortal ? (
          <p className="absolute top-3 left-3 rounded-lg bg-black/50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white">
            {t('Aperçu acheteur (CRM)', 'Buyer preview (CRM)')}
          </p>
        ) : null}
      </div>

      <div className="space-y-6 p-6">
        {/* Titre public = fourchette d'unités (pas le titre marketing courtier) */}
        <h1 className="text-[26px] font-black text-primexpert-dark leading-tight">{headline}</h1>

        {/* KPIs — immédiatement sous le titre (maquette WP) */}
        <section aria-label={t('Indicateurs financiers', 'Financial indicators')}>
          {financeLoading ? (
            <p className="text-[14px] font-semibold text-slate-600">
              {t('Chargement des données financières…', 'Loading financial data…')}
            </p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiTile
                label={t('Revenu net d’exploitation (RNE)', 'Net operating income (NOI)')}
                value={fmt(kpis.revenuNetExploitation)}
              />
              <KpiTile label={t('Cash flow', 'Cash flow')} value={fmt(kpis.cashFlow)} />
              <KpiTile
                label={t('Emprunt maximum', 'Maximum loan')}
                value={fmt(kpis.empruntMaximum)}
              />
              <KpiTile
                label={t('Mise de fonds', 'Down payment')}
                value={fmt(kpis.miseDeFonds)}
              />
            </div>
          )}
        </section>

        {/* 3 boutons or — une seule ligne */}
        <div
          className="flex flex-row flex-nowrap gap-2 sm:gap-3"
          aria-label={t('Actions acheteur (aperçu)', 'Buyer actions (preview)')}
        >
          <button type="button" disabled className={GOLD_BTN} aria-disabled="true">
            ▼ {t('Comprendre ce tableau', 'Understand this table')}
          </button>
          <button type="button" disabled className={GOLD_BTN} aria-disabled="true">
            📊 {t('Analyse financière complète', 'Full financial analysis')}
          </button>
          <button type="button" disabled className={GOLD_BTN} aria-disabled="true">
            ❤️ {t('Ajouter à mes favoris', 'Add to my favourites')}
          </button>
        </div>

        <p
          className="text-[15px] font-black leading-snug text-red-700 border-l-4 border-red-600 pl-4 py-1"
          role="note"
        >
          {legalDisclaimer}
        </p>

        {listing.publicDescription ? (
          <p className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">
            {listing.publicDescription}
          </p>
        ) : null}

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[15px]">
          <PreviewFact label={t('Région', 'Region')} value={listing.region} />
          <PreviewFact label={t('Secteur', 'Sector')} value={listing.secteur} />
          <PreviewFact
            label={t("Taux d'occupation", 'Occupancy rate')}
            value={
              listing.tauxOccupation != null ? `${listing.tauxOccupation} %` : null
            }
            large
          />
          <PreviewFact label={t('Type', 'Type')} value={listing.residenceType} />
        </ul>

        <PreviewTextBlock
          title={t('Inclusions', 'Inclusions')}
          body={listing.publicInclusions}
          emptyHint={t('Aucune inclusion saisie.', 'No inclusions entered.')}
        />
        <PreviewTextBlock
          title={t('Exclusions', 'Exclusions')}
          body={listing.publicExclusions}
          emptyHint={t('Aucune exclusion saisie.', 'No exclusions entered.')}
        />

        <PreviewTextBlock
          title={t('Caractéristiques du bâtiment', 'Building characteristics')}
          body={sections.building}
          emptyHint={t(
            'Section à compléter dans la fiche (champ public).',
            'Section to complete on the listing (public field).'
          )}
        />
        <PreviewTextBlock
          title={t('Services et conditions', 'Services and conditions')}
          body={sections.services}
          emptyHint={t(
            'Section à compléter dans la fiche (champ public).',
            'Section to complete on the listing (public field).'
          )}
        />
        <PreviewTextBlock
          title={t('Soins de santé offerts', 'Health care services offered')}
          body={sections.health}
          emptyHint={t(
            'Section à compléter dans la fiche (champ public).',
            'Section to complete on the listing (public field).'
          )}
        />

        {showBuyerContracts ? (
          <div
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-800 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: PUBLIC_BUYER_CONTRACTS_HTML }}
          />
        ) : null}

        {meta.rpaAVendre && !isPortal ? (
          <p className="text-[14px] font-bold text-emerald-800">
            {t('Diffusion RPAaVendre.com activée', 'RPAaVendre.com syndication enabled')}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function PreviewTextBlock({
  title,
  body,
  emptyHint,
}: {
  title: string;
  body: string | null;
  emptyHint: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-4">
      <h3 className="text-[15px] font-black uppercase tracking-wide text-primexpert-dark mb-2">
        {title}
      </h3>
      {body ? (
        <p className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">{body}</p>
      ) : (
        <p className="text-[14px] font-semibold text-slate-500 italic">{emptyHint}</p>
      )}
    </section>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-primexpert-dark bg-primexpert-light px-3 py-4 text-center min-w-0">
      <p className="text-[11px] sm:text-[12px] font-black uppercase tracking-wide text-primexpert-dark leading-snug">
        {label}
      </p>
      <p className="mt-2 text-[18px] sm:text-[22px] font-black tabular-nums text-black">{value}</p>
    </div>
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
    <li className="rounded-lg border border-slate-200 bg-white px-4 py-3">
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
