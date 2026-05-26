/**
 * Suivi des dossiers — Progression active (contraste V2, encadrés coupe-feu).
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { DossierSuiviStatutAffiche } from '@primexpert/core/transaction';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { useSilo } from '../context/SiloContext';
import { useWorkhubNav } from '../lib/workhubNav';
import { stashListingsFocusResidenceId } from '../lib/listingsFocus';
import { buildResidenceTenantContext, excludeCatalogReferenceResidences, listResidences } from '../services/residences';
import { fetchRecentCallAnalyses } from '../services/transcriptionService';
import {
  InstitutionalDetailLine,
} from './residence/institutional/InstitutionalUi';
import { PageGuideShell } from './institutional/PageGuideHeader';
import {
  institutionalInkTextClass,
  institutionalStatusBannerClass,
} from '../lib/institutionalTheme';
import {
  fetchResidenceDocsMap,
  loadDossierSuiviCards,
  type DossierSuiviCardViewModel,
} from '../services/dossierSuiviService';

const CARD_SHELL: Record<DossierSuiviStatutAffiche, string> = {
  mandat_mise_en_marche: 'border-primexpert-dark border-l-primexpert-dark shadow-xl',
  documents_partages: 'border-slate-400 border-l-slate-400 shadow-xl',
  promesse_acceptee: 'border-primexpert-gold border-l-primexpert-gold shadow-2xl',
};

const HEADER_TINT: Record<DossierSuiviStatutAffiche, string> = {
  mandat_mise_en_marche: 'bg-slate-100',
  documents_partages: 'bg-slate-50',
  promesse_acceptee: 'bg-amber-50/80',
};

const STATUS_BANNER: Record<DossierSuiviStatutAffiche, string> = {
  mandat_mise_en_marche: institutionalStatusBannerClass,
  documents_partages: institutionalStatusBannerClass,
  promesse_acceptee:
    'w-full bg-primexpert-gold text-primexpert-dark text-[12px] font-black uppercase tracking-widest px-4 py-2 rounded mb-4',
};

function DossierCard({
  card,
  onOpenResidence,
  t,
}: {
  card: DossierSuiviCardViewModel;
  onOpenResidence: (id: string) => void;
  t: (fr: string, en: string) => string;
}) {
  return (
    <li
      className={`bg-white border-2 rounded-xl mb-6 overflow-hidden p-5 border-l-[8px] list-none ${CARD_SHELL[card.statut]}`}
    >
      <div className={`-m-5 mb-0 p-5 pb-4 ${HEADER_TINT[card.statut]}`}>
        <p className={`text-sm ${institutionalInkTextClass} leading-snug font-black mb-3`}>
          <button
            type="button"
            onClick={() => onOpenResidence(card.residenceId)}
            className="underline underline-offset-2 hover:text-primexpert-dark/70"
          >
            {card.propertyName}
          </button>
          {' — '}
          <span className="font-semibold">
            {t('Responsable', 'Responsible')}: {card.brokerDisplayName}
          </span>
        </p>
        <div className={STATUS_BANNER[card.statut]}>{card.statutLabel}</div>
      </div>

      <div className="pt-1">
        <InstitutionalDetailLine variant="progression" label={t('PROGRESSION', 'PROGRESS')}>
          {card.progressionText}
        </InstitutionalDetailLine>
        <InstitutionalDetailLine variant="etape" label={t('PROCHAINE ÉTAPE', 'NEXT STEP')}>
          {card.prochaineEtape}
        </InstitutionalDetailLine>
        <InstitutionalDetailLine variant="suggestion" label={t('SUGGESTION IA', 'AI SUGGESTION')}>
          {card.suggestionIA}
        </InstitutionalDetailLine>
      </div>
    </li>
  );
}

export function SuiviDossiersTab() {
  const { profile } = useAuth();
  const { activeSilo } = useSilo();
  const { t } = useLanguage();
  const workhubNav = useWorkhubNav();
  const [cards, setCards] = useState<DossierSuiviCardViewModel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile?.uid) {
      setCards([]);
      setLoading(false);
      return;
    }
    const uid = profile.uid;
    const tenantCtx = buildResidenceTenantContext(profile);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [resList, calls] = await Promise.all([
          listResidences(tenantCtx, { silo: activeSilo }),
          fetchRecentCallAnalyses(uid, 400),
        ]);
        if (cancelled) return;
        const docs = await fetchResidenceDocsMap(
          excludeCatalogReferenceResidences(resList).map((r) => r.id)
        );
        if (cancelled) return;
        const hot = excludeCatalogReferenceResidences(resList);
        setCards(
          loadDossierSuiviCards({
            residences: hot,
            docs,
            brokerDisplayName: profile.displayName || 'Courtier responsable',
            calls,
          })
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, activeSilo]);

  const openResidence = (residenceId: string) => {
    stashListingsFocusResidenceId(residenceId);
    workhubNav?.setActiveTab('listings');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageGuideShell
        title={t('Suivi des dossiers', 'File follow-up')}
        guide={t(
          "Mode d'emploi : [Instructions à venir]",
          'How to use: [Instructions coming soon]'
        )}
      >
        {loading ? (
          <p className="text-sm font-semibold text-white py-4 px-1">
            {t('Chargement…', 'Loading…')}
          </p>
        ) : cards.length === 0 ? (
          <p className="text-sm text-white/90 py-2 leading-relaxed bg-white/10 border-2 border-white/20 rounded-xl p-5">
            {t(
              'Aucun dossier actif pour ce silo (mandat, documents partagés ou promesse acceptée).',
              'No active files for this silo (listing, shared documents, or accepted promise).'
            )}
          </p>
        ) : (
          <ul className="m-0 p-0">
            {cards.map((card) => (
              <DossierCard
                key={card.residenceId}
                card={card}
                onOpenResidence={openResidence}
                t={t}
              />
            ))}
          </ul>
        )}
      </PageGuideShell>
    </motion.div>
  );
}
