import { useCallback, useMemo } from 'react';
import { Globe, Loader2, X } from 'lucide-react';
import { useLanguage } from '../../../lib/i18n';
import type { Residence } from '../../../services/residences';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { parseSyndicationMeta } from '../../../lib/diffusionSyndication';
import { useDiffusionPublication } from '../../../hooks/useDiffusionPublication';
import { usePublicationGuardrails } from '../../../hooks/usePublicationGuardrails';
import { inst } from '../institutional/InstitutionalUi';
import { PublicationStatusCard } from './PublicationStatusCard';
import { PublicFieldsEditor } from './PublicFieldsEditor';
import { PublicPreviewPanel } from './PublicPreviewPanel';
import { SyndicationToggleGrid } from './SyndicationToggleGrid';
import { ConfidentialityChecklist } from './ConfidentialityChecklist';
import { InstitutionalToastBanner } from './InstitutionalToastBanner';

const PRIVATE_ITEMS_FR = [
  'Nom commercial réel de la résidence',
  'Adresse civique exacte',
  'Téléphone ou courriel du vendeur',
  'Prix de vente exact',
  'États financiers et documents de diligence',
  'Identité du courtier inscripteur',
] as const;

const PRIVATE_ITEMS_EN = [
  'Actual commercial name of the residence',
  'Exact civic address',
  'Seller phone or email',
  'Exact asking price',
  'Financial statements and diligence documents',
  'Listing broker identity',
] as const;

export interface DiffusionWebTabProps {
  residence: Residence;
}

export function DiffusionWebTab({ residence }: DiffusionWebTabProps) {
  const { t, language } = useLanguage();
  const { residenceDoc, loading, error, isInProvider, saveError, updateResidence, saving } =
    useResidenceDocument();

  const {
    toast,
    dismissToast,
    isPublishing,
    isSavingDraft,
    isHiding,
    isBusy,
    publish,
    saveDraft,
    hide,
  } = useDiffusionPublication(residence.id);

  const meta = useMemo(
    () => parseSyndicationMeta(residenceDoc ?? undefined),
    [residenceDoc]
  );

  const guardrails = usePublicationGuardrails(residenceDoc);

  const privateItems = language === 'fr' ? PRIVATE_ITEMS_FR : PRIVATE_ITEMS_EN;

  const handleViewOnline = useCallback(() => {
    if (meta.wpUrl) window.open(meta.wpUrl, '_blank', 'noopener,noreferrer');
  }, [meta.wpUrl]);

  const handleSyndicationToggle = useCallback(
    async (portal: 'rpaAVendre' | 'cpeAVendre' | 'plexAVendre', enabled: boolean) => {
      if (!residenceDoc) return;
      const current = parseSyndicationMeta(residenceDoc);
      await updateResidence({
        syndication: {
          ...current,
          [portal]: enabled,
        },
      });
    },
    [residenceDoc, updateResidence]
  );

  if (!isInProvider) {
    return (
      <p className={inst.alertAmber}>
        {t('Provider document résidence manquant.', 'Residence document provider missing.')}
      </p>
    );
  }

  if (loading) {
    return (
      <div className={inst.loading}>
        <p className={inst.loadingText}>{t('Chargement diffusion…', 'Loading syndication…')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <p className={inst.alertRed}>
        {t('Erreur Firestore', 'Firestore error')}: {error.message}
      </p>
    );
  }

  return (
    <div className={inst.page + ' space-y-6'}>
      <InstitutionalToastBanner toast={toast} onDismiss={dismissToast} />

      {saveError ? <p className={inst.alertRed}>{saveError}</p> : null}

      <PublicationStatusCard
        meta={meta}
        isSavingDraft={isSavingDraft}
        isHiding={isHiding}
        isBusy={isBusy}
        onViewOnline={handleViewOnline}
        onSaveDraft={() => void saveDraft()}
        onHide={() => void hide('MASQUE')}
      />

      <section className="rounded-xl border-4 border-red-900 bg-red-50 px-6 py-6">
        <h2 className="text-[18px] font-black uppercase tracking-wide text-red-950 mb-4">
          {t('Zone privée — jamais publiée', 'Private zone — never published')}
        </h2>
        <ul className="space-y-3">
          {privateItems.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 text-[15px] font-bold text-red-950"
            >
              <X className="h-6 w-6 shrink-0 text-red-800" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border-2 border-emerald-800 bg-white p-6 space-y-6">
        <header>
          <h2 className="text-[18px] font-black uppercase tracking-wide text-emerald-900">
            {t('Zone publique — ce que verra l’acheteur', 'Public zone — what buyers will see')}
          </h2>
          <p className="text-[15px] text-slate-700 mt-2 leading-relaxed">
            {t(
              'Les champs ci-dessous alimentent le silo public_listings après anonymisation automatique (secteur, fourchette de prix, taux arrondi).',
              'Fields below feed the public_listings silo after automatic anonymization (sector, price range, rounded occupancy).'
            )}
          </p>
        </header>

        <SyndicationToggleGrid
          assetNiche={residence.assetNiche}
          meta={meta}
          disabled={saving || isBusy}
          onToggle={(portal, enabled) => void handleSyndicationToggle(portal, enabled)}
        />

        <PublicFieldsEditor disabled={isBusy} />

        <PublicPreviewPanel />
      </section>

      <ConfidentialityChecklist evaluation={guardrails} />

      {!guardrails?.isPublishable ? (
        <p className="rounded-xl border-2 border-red-800 bg-red-50 px-5 py-4 text-[15px] font-bold text-red-950">
          {t(
            'Publication en ligne verrouillée — corrigez tous les points bloquants (❌) ci-dessus. Le brouillon reste disponible pour usage interne.',
            'Online publishing locked — fix all blocking items (❌) above. Draft remains available for internal use.'
          )}
        </p>
      ) : null}

      <button
        type="button"
        disabled={isBusy || saving || !guardrails?.isPublishable}
        title={
          !guardrails?.isPublishable
            ? t('Conformité incomplète — publication bloquée', 'Incomplete compliance — publishing blocked')
            : undefined
        }
        onClick={() => void publish()}
        className="w-full min-h-[64px] rounded-xl border-4 border-emerald-800 bg-emerald-700 px-6 py-4 text-[18px] font-black uppercase tracking-wide text-white hover:bg-emerald-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPublishing ? (
          <span className="inline-flex items-center justify-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin" />
            {t('Publication en cours…', 'Publishing…')}
          </span>
        ) : (
          <span className="inline-flex items-center justify-center gap-3">
            <Globe className="h-7 w-7" />
            {t('Publier en ligne', 'Publish online')}
          </span>
        )}
      </button>
    </div>
  );
}
