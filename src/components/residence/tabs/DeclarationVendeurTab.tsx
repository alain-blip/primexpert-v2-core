/**
 * Déclaration du vendeur — onglet institutionnel V2 (Gold Signature).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import {
  buildDeclarationAnswerPatch,
  buildDeclarationCertifyPatch,
  computeDeclarationProgress,
  normalizeDeclarationVendeur,
} from '@primexpert/core/declaration';
import type { DeclarationResponse } from '@primexpert/core/declaration';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { useAuth } from '../../../lib/auth';
import { useLanguage } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';
import { DeclarationCertificationHeader } from '../declaration/DeclarationCertificationHeader';
import { DeclarationQuestionnaire } from '../declaration/DeclarationQuestionnaire';
import { inst } from '../institutional/InstitutionalUi';
import {
  institutionalListingsActionButtonClass,
  institutionalListingsCardShellClass,
  institutionalListingsFailSafeClass,
  institutionalListingsPanelClass,
} from '../../../lib/institutionalTheme';

export function DeclarationVendeurTab() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const {
    residenceDoc,
    residenceId,
    loading,
    error,
    isInProvider,
    saving,
    saveError,
    updateResidence,
  } = useResidenceDocument();

  const [certifying, setCertifying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const declaration = useMemo(
    () => normalizeDeclarationVendeur(residenceDoc),
    [residenceDoc]
  );

  const progress = useMemo(
    () => computeDeclarationProgress(residenceDoc),
    [residenceDoc]
  );

  const isUploaded = progress.isUploaded;
  const locked = progress.isLocked || isUploaded;

  const certifiedByLabel = useMemo(() => {
    const uid = progress.certifiedBy ?? declaration.certifiedBy;
    if (!uid) return null;
    if (profile?.uid === uid) {
      return (
        profile.displayName?.trim() ||
        profile.email?.trim() ||
        uid
      );
    }
    return uid;
  }, [progress.certifiedBy, declaration.certifiedBy, profile]);

  const handleResponse = useCallback(
    async (questionId: string, response: DeclarationResponse) => {
      if (!residenceDoc || locked) return;
      setLocalError(null);
      try {
        const patch = buildDeclarationAnswerPatch(residenceDoc, questionId, { response });
        await updateResidence(patch);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'DECLARATION_UPLOADED') {
          setLocalError(
            t(
              'Un document signé a été fourni. Contactez votre courtier pour toute modification.',
              'A signed document was provided. Contact your broker for any changes.'
            )
          );
        } else if (msg === 'DECLARATION_LOCKED') {
          setLocalError(
            t('Déclaration verrouillée.', 'Declaration is locked.')
          );
        } else {
          setLocalError(msg);
        }
      }
    },
    [residenceDoc, locked, updateResidence, t]
  );

  const handleNotes = useCallback(
    async (questionId: string, notes: string) => {
      if (!residenceDoc || locked) return;
      setLocalError(null);
      try {
        const patch = buildDeclarationAnswerPatch(residenceDoc, questionId, { notes });
        await updateResidence(patch);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : String(err));
      }
    },
    [residenceDoc, locked, updateResidence]
  );

  const handleValue = useCallback(
    async (questionId: string, value: string) => {
      if (!residenceDoc || locked) return;
      setLocalError(null);
      try {
        const patch = buildDeclarationAnswerPatch(residenceDoc, questionId, { value });
        await updateResidence(patch);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : String(err));
      }
    },
    [residenceDoc, locked, updateResidence]
  );

  const handleCertify = useCallback(async () => {
    if (!residenceDoc || !profile?.uid || !residenceId || locked) return;
    if (!progress.isComplete) {
      const criticalMsg =
        language === 'fr'
          ? progress.criticalLockMessageFr
          : progress.criticalLockMessageEn;
      setLocalError(
        criticalMsg ??
          t(
            'Complétez tous les champs obligatoires (Oui/Non/N/A) avant de certifier.',
            'Complete all required fields (Yes/No/N/A) before certifying.'
          )
      );
      return;
    }
    setCertifying(true);
    setLocalError(null);
    try {
      const patch = buildDeclarationCertifyPatch(
        residenceDoc,
        profile.uid,
        residenceId
      );
      await updateResidence(patch);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setCertifying(false);
    }
  }, [
    residenceDoc,
    profile?.uid,
    residenceId,
    locked,
    progress.isComplete,
    progress.criticalLockMessageFr,
    progress.criticalLockMessageEn,
    language,
    updateResidence,
    t,
  ]);

  if (!isInProvider) {
    return (
      <div className={institutionalListingsFailSafeClass}>
        {t('Provider document résidence manquant.', 'Residence document provider missing.')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className={institutionalListingsFailSafeClass}>
        <p className={inst.loadingText}>
          {t('Chargement de la déclaration…', 'Loading disclosure…')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={institutionalListingsFailSafeClass}>
        {t('Erreur Firestore', 'Firestore error')}: {error.message}
      </div>
    );
  }

  if (!residenceId) {
    return (
      <div className={institutionalListingsFailSafeClass}>
        {t('Identifiant de résidence manquant.', 'Residence id missing.')}
      </div>
    );
  }

  return (
    <div className={institutionalListingsPanelClass}>
      <div className={institutionalListingsCardShellClass}>
        <DeclarationCertificationHeader
          residenceId={residenceId}
          declaration={declaration}
          progress={progress}
          certifiedByLabel={certifiedByLabel}
        />
      </div>

      {(localError || saveError) && (
        <div className={institutionalListingsFailSafeClass}>
          {localError || saveError}
        </div>
      )}

      {!isUploaded ? (
        <div className={cn(institutionalListingsCardShellClass, progress.isLocked && 'pointer-events-none')}>
          <DeclarationQuestionnaire
            declaration={declaration}
            locked={progress.isLocked}
            saving={saving}
            onResponse={handleResponse}
            onNotes={handleNotes}
            onValue={handleValue}
          />
        </div>
      ) : null}

      {!isUploaded && !progress.isLocked ? (
        <div className={cn(institutionalListingsCardShellClass, 'flex flex-col items-center justify-between gap-4 px-6 py-6 pointer-events-auto sm:flex-row')}>
          <p className="max-w-md text-xs text-slate-700">
            {t(
              'En certifiant, vous attestez l’exactitude des réponses. Le questionnaire passera en lecture seule.',
              'By certifying, you attest the accuracy of your answers. The questionnaire becomes read-only.'
            )}
          </p>
          <button
            type="button"
            disabled={certifying || saving || !progress.isComplete || !progress.criticalLocksMet}
            onClick={() => void handleCertify()}
            className={cn(
              institutionalListingsActionButtonClass,
              'inline-flex items-center gap-2 px-6 py-3 text-[10px] tracking-[0.16em]',
              'transition hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {certifying || saving ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
            ) : (
              <Shield className="h-4 w-4 text-[#D4AF37]" />
            )}
            {t('Certifier la déclaration', 'Certify disclosure')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
