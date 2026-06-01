/**
 * Indicateur WORM + action de verrouillage — onglet Documents fiche résidence.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, LockOpen, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { PropertyDocumentRecord } from '../../../types/propertyDocument';
import {
  formatLegalVaultPermissionError,
  isFirestorePermissionDenied,
  lockLegalVaultDocument,
  subscribeLegalVaultDocument,
  type LegalVaultFirestoreRecord,
} from '../../../services/legalVaultService';
import {
  buildLegalVaultDocumentId,
  resolveLicenseTypeLabel,
} from '../../../lib/legalVaultDocumentMapping';
import { LegalVaultWormLockModal } from './LegalVaultWormLockModal';

export interface LegalVaultWormPanelProps {
  orgId: string;
  propertyId: string;
  brokerId: string;
  document: PropertyDocumentRecord;
  licenseName?: string;
  licenseTitle?: string;
  contractPrice?: number;
  locale: 'fr' | 'en';
  /** État pré-chargé depuis la liste (évite flash). */
  vaultRecord?: LegalVaultFirestoreRecord | null;
  compact?: boolean;
}

function WormBadge({
  locked,
  locale,
  compact,
}: {
  locked: boolean;
  locale: 'fr' | 'en';
  compact?: boolean;
}) {
  const fr = locale === 'fr';
  if (locked) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border-2 border-red-700 bg-red-600 font-black uppercase text-white',
          compact ? 'px-2 py-0.5 text-[8px] tracking-wide' : 'px-2.5 py-1 text-[9px] tracking-[0.12em]'
        )}
      >
        <Lock className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
        {fr ? 'Sécurisé WORM / OACIQ' : 'WORM / OACIQ secured'}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold uppercase text-slate-600',
        compact ? 'px-2 py-0.5 text-[8px] tracking-wide' : 'px-2.5 py-1 text-[9px] tracking-[0.12em]'
      )}
    >
      <LockOpen className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      {fr ? 'Brouillon' : 'Draft'}
    </span>
  );
}

export function LegalVaultWormPanel({
  orgId,
  propertyId,
  brokerId,
  document,
  licenseName,
  licenseTitle,
  contractPrice = 0,
  locale,
  vaultRecord: vaultRecordProp,
  compact = false,
}: LegalVaultWormPanelProps) {
  const fr = locale === 'fr';
  const vaultDocumentId = buildLegalVaultDocumentId(propertyId, document.id);
  const [vaultRecord, setVaultRecord] = useState<LegalVaultFirestoreRecord | null>(
    vaultRecordProp ?? null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = vaultRecord?.isFinalWormLocked === true;

  useEffect(() => {
    setVaultRecord(vaultRecordProp ?? null);
  }, [vaultRecordProp, document.id]);

  useEffect(() => {
    if (!orgId || vaultRecordProp !== undefined) return undefined;
    return subscribeLegalVaultDocument(orgId, vaultDocumentId, setVaultRecord);
  }, [orgId, vaultDocumentId, vaultRecordProp]);

  const initialMetadata = useMemo(
    () => ({
      contractPrice: vaultRecord?.metadataFieldsCrossChecked?.contractPrice ?? contractPrice,
      validatedLicenseName:
        vaultRecord?.metadataFieldsCrossChecked?.validatedLicenseName ??
        licenseName?.trim() ??
        '',
      licenseType:
        vaultRecord?.metadataFieldsCrossChecked?.licenseType ??
        resolveLicenseTypeLabel(licenseTitle, locale),
    }),
    [vaultRecord, contractPrice, licenseName, licenseTitle, locale]
  );

  const handleConfirmLock = useCallback(
    async (metadata: typeof initialMetadata) => {
      if (!orgId || !brokerId) return;
      setLocking(true);
      setError(null);
      try {
        await lockLegalVaultDocument({
          orgId,
          brokerId,
          propertyId,
          propertyDocument: document,
          metadataFieldsCrossChecked: metadata,
        });
        setModalOpen(false);
      } catch (e) {
        if (isFirestorePermissionDenied(e)) {
          setError(formatLegalVaultPermissionError(locale));
        } else {
          setError(
            e instanceof Error
              ? e.message
              : fr
                ? 'Verrouillage impossible.'
                : 'Unable to lock document.'
          );
        }
      } finally {
        setLocking(false);
      }
    },
    [orgId, brokerId, propertyId, document, locale, fr]
  );

  if (!orgId) return null;

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-2',
          compact ? 'items-start' : 'rounded-xl border border-slate-100 bg-slate-50/80 p-3'
        )}
      >
        <div className="flex w-full flex-wrap items-center gap-2">
          <WormBadge locked={locked} locale={locale} compact={compact} />
          <button
            type="button"
            disabled={locked || locking || document.virusScanStatus !== 'clean'}
            onClick={() => {
              if (locked) return;
              setError(null);
              setModalOpen(true);
            }}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl border font-black uppercase tracking-wider',
              locked
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                : 'border-[#142c6a] bg-white text-[#142c6a] hover:bg-blue-50 disabled:opacity-50',
              compact
                ? 'px-2 py-1 text-[8px]'
                : 'w-full px-3 py-2.5 text-[10px] sm:w-auto sm:min-w-[200px]'
            )}
            title={
              locked
                ? fr
                  ? 'Document scellé — verrouillage légal OACIQ actif'
                  : 'Document sealed — OACIQ legal lock active'
                : document.virusScanStatus !== 'clean'
                  ? fr
                    ? 'Vérification de sécurité requise avant verrouillage'
                    : 'Security verification required before locking'
                  : undefined
            }
          >
            {locking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : locked ? (
              <Lock className="h-4 w-4" />
            ) : (
              <LockOpen className="h-4 w-4" />
            )}
            {fr ? 'Verrouiller définitivement' : 'Lock permanently'}
          </button>
        </div>

        {!compact && locked && vaultRecord?.lockedAtMillis ? (
          <p className="text-[10px] text-slate-500">
            {fr ? 'Verrouillé le ' : 'Locked on '}
            {new Date(vaultRecord.lockedAtMillis).toLocaleString(fr ? 'fr-CA' : 'en-CA', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </p>
        ) : null}

        {error ? (
          <p className="text-[11px] font-semibold text-red-800" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <LegalVaultWormLockModal
        open={modalOpen}
        locale={locale}
        busy={locking}
        fileName={document.fileName}
        initialMetadata={initialMetadata}
        onConfirm={(m) => void handleConfirmLock(m)}
        onCancel={() => {
          if (!locking) setModalOpen(false);
        }}
      />
    </>
  );
}

/** Badge compact pour la liste de documents. */
export function LegalVaultWormListBadge({
  locked,
  locale,
}: {
  locked: boolean;
  locale: 'fr' | 'en';
}) {
  return <WormBadge locked={locked} locale={locale} compact />;
}
