/**
 * Attribution courtier responsable (courtiersResponsables) — section Identité.
 */

import { useCallback, useState } from 'react';
import { UserCheck, UserPlus } from 'lucide-react';
import { TENANT_FIELD } from '@primexpert/core/tenant';
import { useLanguage } from '../../../lib/i18n';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';

function isUnassignedBroker(courtiersResponsables: string | undefined): boolean {
  return !courtiersResponsables || courtiersResponsables.trim() === '';
}

export interface ResponsibleBrokerCardProps {
  brokerId: string;
  brokerDisplayName?: string;
  courtiersResponsables?: string;
}

export function ResponsibleBrokerCard({
  brokerId,
  brokerDisplayName,
  courtiersResponsables,
}: ResponsibleBrokerCardProps) {
  const { t } = useLanguage();
  const { updateResidence, saving, saveError } = useResidenceDocument();
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const assigned = courtiersResponsables?.trim() ?? '';
  const isMine = Boolean(brokerId && assigned === brokerId);
  const isShared = isUnassignedBroker(courtiersResponsables);
  const isOther = Boolean(assigned && !isMine);

  const handleClaim = useCallback(async () => {
    if (!brokerId || !isShared) return;
    setLocalError(null);
    setPending(true);
    try {
      await updateResidence({ [TENANT_FIELD]: brokerId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLocalError(msg);
    } finally {
      setPending(false);
    }
  }, [brokerId, isShared, updateResidence]);

  return (
    <div className="mb-5 rounded-lg border-2 border-[#2563eb]/25 bg-blue-50/40 px-4 py-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#142c6a]">
        {t('Courtier immobilier responsable (OACIQ)', 'Responsible broker (OACIQ)')}
      </p>

      {isMine ? (
        <div className="mt-3 flex items-start gap-2 text-sm text-emerald-900">
          <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          <p>
            {t(
              'Vous êtes le courtier responsable de cette fiche. Hub Finance, documents et exports PDF sont déverrouillés.',
              'You are the responsible broker for this file. Finance Hub, documents and PDF exports are unlocked.'
            )}
            {brokerDisplayName ? (
              <span className="mt-1 block font-semibold">{brokerDisplayName}</span>
            ) : null}
          </p>
        </div>
      ) : null}

      {isShared ? (
        <div className="mt-3 space-y-3">
          <p className="text-[13px] leading-relaxed text-slate-800">
            {t(
              'Cette fiche est au catalogue partagé (aucun courtier assigné). Attribuez-vous la responsabilité pour modifier les finances, téléverser des documents et générer les rapports PDF.',
              'This listing is in the shared catalog (no broker assigned). Assign yourself to edit finances, upload documents and generate PDF reports.'
            )}
          </p>
          <button
            type="button"
            disabled={pending || saving || !brokerId}
            onClick={() => void handleClaim()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border-2 border-[#142c6a] bg-[#D4AF37] px-4 py-2 text-[13px] font-black text-black hover:bg-[#c9a432] disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
            {pending || saving
              ? t('Attribution…', 'Assigning…')
              : t('M’attribuer cette résidence', 'Assign this residence to me')}
          </button>
        </div>
      ) : null}

      {isOther ? (
        <p className="mt-3 text-[13px] leading-relaxed text-amber-950">
          {t(
            'Cette fiche est déjà assignée à un autre courtier. Seul un administrateur d’agence peut réassigner le mandat.',
            'This listing is already assigned to another broker. Only an agency administrator can reassign the mandate.'
          )}
        </p>
      ) : null}

      {localError || saveError ? (
        <p className="mt-3 text-[12px] font-bold text-red-800" role="alert">
          {localError ?? saveError}
        </p>
      ) : null}
    </div>
  );
}
