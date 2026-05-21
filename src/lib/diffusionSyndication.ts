/**
 * Lecture des métadonnées de syndication sur `residences/{id}.syndication`.
 * Couche app uniquement — le silo `public_listings` reste côté Functions.
 */

import type { AssetSyndication, AssetNiche } from '../types/residence';
import type { PublicListingStatusUi } from '../services/diffusionClient';

export interface ResidenceSyndicationMeta extends AssetSyndication {
  publicListingId?: string;
  publicListingStatus?: PublicListingStatusUi;
  wpPostId?: number;
  wpUrl?: string;
  wpStatus?: string;
  draftToken?: string;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

export function parseSyndicationMeta(
  residenceDoc: Record<string, unknown> | null | undefined
): ResidenceSyndicationMeta {
  const syn = asRecord(residenceDoc?.syndication ?? residenceDoc?.marketingSyndication);
  if (!syn) return {};

  const wpPostIdRaw = syn.wpPostId;
  const wpPostId =
    typeof wpPostIdRaw === 'number' && Number.isFinite(wpPostIdRaw)
      ? wpPostIdRaw
      : undefined;

  const statusRaw = String(syn.publicListingStatus ?? '').trim().toUpperCase();
  const allowed: PublicListingStatusUi[] = ['VISIBLE', 'MASQUE', 'SUSPENDU', 'ARCHIVE'];
  const publicListingStatus = allowed.includes(statusRaw as PublicListingStatusUi)
    ? (statusRaw as PublicListingStatusUi)
    : undefined;

  return {
    rpaAVendre: syn.rpaAVendre === true,
    cpeAVendre: syn.cpeAVendre === true,
    plexAVendre: syn.plexAVendre === true,
    publicListingId:
      typeof syn.publicListingId === 'string' && syn.publicListingId
        ? syn.publicListingId
        : undefined,
    publicListingStatus,
    wpPostId,
    wpUrl: typeof syn.wpUrl === 'string' && syn.wpUrl ? syn.wpUrl : undefined,
    wpStatus: typeof syn.wpStatus === 'string' ? syn.wpStatus : undefined,
    draftToken:
      typeof syn.draftToken === 'string' && syn.draftToken ? syn.draftToken : undefined,
  };
}

/** Indique si une publication (ou brouillon WP) a déjà été tentée avec succès. */
export function hasEverBeenPublished(meta: ResidenceSyndicationMeta): boolean {
  return Boolean(meta.publicListingId || meta.wpPostId);
}

export function isPortalRelevant(niche: AssetNiche | undefined, portal: AssetNiche): boolean {
  const active = niche ?? 'RPA';
  return active === portal;
}

const RPA_PUBLIC_SITE = 'https://rpaavendre.com';

/**
 * URL d'aperçu vendeur (brouillon) — jeton serveur ou paramètre preview.
 */
export function buildSellerPreviewUrl(
  meta: ResidenceSyndicationMeta,
  residenceId?: string
): string | null {
  const publicId = meta.publicListingId?.trim();
  const wpUrl = meta.wpUrl?.trim();

  if (meta.draftToken && wpUrl) {
    try {
      const url = new URL(wpUrl);
      url.searchParams.set('preview', 'true');
      url.searchParams.set('token', meta.draftToken);
      return url.toString();
    } catch {
      /* fall through */
    }
  }

  if (wpUrl) {
    try {
      const url = new URL(wpUrl);
      url.searchParams.set('preview', 'true');
      return url.toString();
    } catch {
      return `${wpUrl}${wpUrl.includes('?') ? '&' : '?'}preview=true`;
    }
  }

  const slugId = publicId ?? residenceId;
  if (!slugId) return null;

  const shortSlug = slugId.startsWith('rpa-') ? slugId : `rpa-${slugId.slice(0, 8)}`;
  const base = `${RPA_PUBLIC_SITE}/annonce_rpa/${shortSlug}/`;
  if (meta.draftToken) {
    return `${base}?preview=true&token=${encodeURIComponent(meta.draftToken)}`;
  }
  return `${base}?preview=true`;
}
