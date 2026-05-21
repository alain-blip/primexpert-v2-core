import { ExternalLink, FileEdit, Globe, Loader2, Ban, Eye, Link2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import type { ResidenceSyndicationMeta } from '../../../lib/diffusionSyndication';
import { hasEverBeenPublished } from '../../../lib/diffusionSyndication';

const ACTION_BTN =
  'inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-2 px-5 py-3 text-[15px] font-black uppercase tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed';

export interface PublicationStatusCardProps {
  meta: ResidenceSyndicationMeta;
  isSavingDraft: boolean;
  isHiding: boolean;
  isBusy: boolean;
  onViewOnline: () => void;
  onSaveDraft: () => void;
  onHide: () => void;
  onOpenDraftPreview: () => void;
  onCopySellerLink: () => void;
  sellerLinkCopied?: boolean;
  sellerLinkAvailable?: boolean;
}

export function PublicationStatusCard({
  meta,
  isSavingDraft,
  isHiding,
  isBusy,
  onViewOnline,
  onSaveDraft,
  onHide,
  onOpenDraftPreview,
  onCopySellerLink,
  sellerLinkCopied = false,
  sellerLinkAvailable = true,
}: PublicationStatusCardProps) {
  const { t, language } = useLanguage();
  const status = meta.publicListingStatus;
  const wasPublished = hasEverBeenPublished(meta);
  const isVisible = status === 'VISIBLE';
  const isHiddenAfterPublish = wasPublished && status !== 'VISIBLE';

  const statusLabelFr: Record<string, string> = {
    VISIBLE: 'EN LIGNE — Visible sur le portail',
    MASQUE: 'MASQUÉE — Retirée du portail public',
    SUSPENDU: 'SUSPENDUE — Publication interrompue',
    ARCHIVE: 'ARCHIVÉE — Fiche retirée définitivement',
  };
  const statusLabelEn: Record<string, string> = {
    VISIBLE: 'LIVE — Visible on the portal',
    MASQUE: 'HIDDEN — Removed from public portal',
    SUSPENDU: 'SUSPENDED — Publication paused',
    ARCHIVE: 'ARCHIVED — Listing permanently removed',
  };

  const label =
    language === 'fr'
      ? statusLabelFr[status ?? ''] ??
        (wasPublished ? 'Brouillon ou jamais publié' : 'Jamais publiée sur le web')
      : statusLabelEn[status ?? ''] ??
        (wasPublished ? 'Draft or never live' : 'Never published on the web');

  return (
    <section
      className={cn(
        'rounded-xl border-4 px-6 py-6 shadow-xl',
        isVisible && 'border-emerald-800 bg-emerald-950 text-white',
        isHiddenAfterPublish && 'border-red-800 bg-red-950 text-white',
        !isVisible && !isHiddenAfterPublish && 'border-primexpert-dark bg-primexpert-dark text-white'
      )}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start gap-4 mb-6">
        <Globe className="h-10 w-10 shrink-0 opacity-90" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black uppercase tracking-[0.2em] text-white/80 mb-1">
            {t('Statut diffusion web', 'Web syndication status')}
          </p>
          <p className="text-[26px] font-black tabular-nums leading-tight tracking-tight">{label}</p>
          {meta.wpUrl && isVisible ? (
            <p className="mt-2 text-[14px] font-mono text-white/70 truncate">{meta.wpUrl}</p>
          ) : null}
          {meta.draftToken && status === 'MASQUE' ? (
            <p className="mt-2 text-[14px] text-amber-200">
              {t(
                'Jeton aperçu vendeur actif (brouillon privé).',
                'Seller preview token active (private draft).'
              )}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={isBusy}
          onClick={onOpenDraftPreview}
          className={cn(
            ACTION_BTN,
            'border-sky-200 bg-sky-100 text-primexpert-dark hover:bg-sky-50'
          )}
        >
          <Eye className="h-5 w-5 shrink-0" />
          {t('Visualiser le brouillon', 'Preview draft')}
        </button>

        <button
          type="button"
          disabled={isBusy || !sellerLinkAvailable}
          onClick={onCopySellerLink}
          className={cn(
            ACTION_BTN,
            sellerLinkCopied
              ? 'border-emerald-200 bg-emerald-100 text-emerald-950'
              : 'border-white/50 bg-white/15 text-white hover:bg-white/25'
          )}
        >
          <Link2 className="h-5 w-5 shrink-0" />
          {sellerLinkCopied
            ? t('Lien copié', 'Link copied')
            : t('Lien vendeur', 'Seller link')}
        </button>

        <button
          type="button"
          disabled={!meta.wpUrl || isBusy}
          onClick={onViewOnline}
          className={cn(
            ACTION_BTN,
            isVisible
              ? 'border-white bg-white text-emerald-950 hover:bg-emerald-50'
              : 'border-white/40 bg-white/10 text-white hover:bg-white/20'
          )}
        >
          <ExternalLink className="h-5 w-5 shrink-0" />
          {t('Voir en ligne', 'View online')}
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={onSaveDraft}
          className={cn(
            ACTION_BTN,
            'border-amber-300 bg-amber-400 text-primexpert-dark hover:bg-amber-300'
          )}
        >
          {isSavingDraft ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <FileEdit className="h-5 w-5 shrink-0" />
          )}
          {t('Brouillon', 'Draft')}
        </button>

        <button
          type="button"
          disabled={!wasPublished || isBusy}
          onClick={onHide}
          className={cn(
            ACTION_BTN,
            isHiddenAfterPublish
              ? 'border-red-300 bg-red-800 text-white'
              : 'border-white/50 bg-transparent text-white hover:bg-red-900/40'
          )}
        >
          {isHiding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Ban className="h-5 w-5 shrink-0" />}
          {t('Retirer', 'Remove')}
        </button>
      </div>
    </section>
  );
}
