/**
 * Suivi des dossiers — Progression (accueil Workhub, lexique Québec, KISS 3 lignes).
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { useSilo } from '../context/SiloContext';
import { useWorkhubNav } from '../lib/workhubNav';
import { stashListingsFocusResidenceId } from '../lib/listingsFocus';
import { listResidences } from '../services/residences';
import {
  fetchResidenceDocsMap,
  loadDossierSuiviCards,
  type DossierSuiviCardViewModel,
} from '../services/dossierSuiviService';

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
    <li className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-2">
      <p className="text-sm text-[#000000] leading-snug">
        <button
          type="button"
          onClick={() => onOpenResidence(card.residenceId)}
          className="font-semibold underline underline-offset-2 hover:text-slate-700"
        >
          {card.propertyName}
        </button>
        {' — '}
        {t('Responsable', 'Responsible')}:{' '}
        <span className="font-semibold">{card.brokerDisplayName}</span>
        {' | '}
        {t('Statut', 'Status')}:{' '}
        <span className="font-semibold">{card.statutLabel}</span>
      </p>
      <p className="text-sm text-[#000000] leading-relaxed">
        <span className="font-semibold">{t('Suivi', 'Follow-up')}:</span> {card.suiviTexte}
      </p>
      <p
        className={`text-sm leading-relaxed ${
          card.ligne3IsWormLock ? 'text-[#000000] font-semibold' : 'text-[#000000]'
        }`}
      >
        {card.ligne3IsWormLock ? (
          card.ligne3Texte
        ) : (
          <>
            <span className="font-semibold">{t('Vérifications', 'Checks')}:</span>{' '}
            {card.ligne3Texte}
          </>
        )}
      </p>
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
    const uid = profile?.uid;
    if (!uid) {
      setCards([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const resList = await listResidences({ tenantId: uid, mode: 'strict' }, { silo: activeSilo });
        if (cancelled) return;
        const docs = await fetchResidenceDocsMap(resList.map((r) => r.id));
        if (cancelled) return;
        setCards(
          loadDossierSuiviCards({
            residences: resList,
            docs,
            brokerDisplayName: profile.displayName || 'Courtier responsable',
          })
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, profile?.displayName, activeSilo]);

  const openResidence = (residenceId: string) => {
    stashListingsFocusResidenceId(residenceId);
    workhubNav?.setActiveTab('listings');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="mb-6">
        <h2 className="text-lg font-black text-[#000000] tracking-tight">
          {t('Suivi des dossiers — Progression', 'File follow-up — Progress')}
        </h2>
        <p className="text-sm text-[#000000] mt-1 leading-relaxed">
          {t(
            'Vue d’ensemble des inscriptions en cours de partage documentaire, de promesse d’achat ou vendues.',
            'Overview of listings with shared documents, accepted purchase promises, or sold.'
          )}
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-[#000000] py-4">{t('Chargement…', 'Loading…')}</p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-[#000000] py-2 leading-relaxed">
          {t(
            'Aucun dossier en progression pour ce silo (documents partagés, promesse acceptée ou vendu).',
            'No files in progress for this silo (shared documents, accepted promise, or sold).'
          )}
        </p>
      ) : (
        <ul className="space-y-3">
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
    </motion.div>
  );
}
