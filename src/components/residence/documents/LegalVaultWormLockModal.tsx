/**
 * Modale de confirmation — verrouillage légal OACIQ (WORM).
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import type { LegalVaultMetadataCrossCheck } from '@primexpert/core/security';

export interface LegalVaultWormLockModalProps {
  open: boolean;
  locale: 'fr' | 'en';
  busy?: boolean;
  fileName: string;
  initialMetadata: LegalVaultMetadataCrossCheck;
  onConfirm: (metadata: LegalVaultMetadataCrossCheck) => void;
  onCancel: () => void;
}

export function LegalVaultWormLockModal({
  open,
  locale,
  busy = false,
  fileName,
  initialMetadata,
  onConfirm,
  onCancel,
}: LegalVaultWormLockModalProps) {
  const [metadata, setMetadata] = useState(initialMetadata);

  useEffect(() => {
    if (open) setMetadata(initialMetadata);
  }, [open, initialMetadata]);

  if (!open) return null;

  const fr = locale === 'fr';

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-vault-worm-lock-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="bg-[#142c6a] px-5 py-5 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 shrink-0 text-[#D4AF37]" aria-hidden />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
                {fr ? 'Conformité OACIQ' : 'OACIQ compliance'}
              </p>
              <h2 id="legal-vault-worm-lock-title" className="text-base font-black leading-snug sm:text-lg">
                {fr ? 'Verrouillage légal définitif' : 'Permanent legal lock'}
              </h2>
            </div>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="text-[13px] leading-relaxed text-slate-700">
            {fr
              ? `Vous êtes sur le point de verrouiller définitivement « ${fileName} » dans le coffre-fort WORM. Cette action est irréversible pendant la période de conservation légale (6 ans).`
              : `You are about to permanently lock “${fileName}” in the WORM vault. This action is irreversible for the legal retention period (6 years).`}
          </p>

          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-950">
            {fr
              ? 'Vérification des métadonnées LCI — confirmez le nom au permis, le type de permis et le prix au contrat avant de sceller le document.'
              : 'LCI metadata verification — confirm license name, license type and contract price before sealing the document.'}
          </p>

          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {fr ? 'Nom au permis' : 'Name on license'}
            </span>
            <input
              type="text"
              value={metadata.validatedLicenseName}
              onChange={(e) =>
                setMetadata((m) => ({ ...m, validatedLicenseName: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              disabled={busy}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {fr ? 'Type de permis' : 'License type'}
            </span>
            <input
              type="text"
              value={metadata.licenseType}
              onChange={(e) => setMetadata((m) => ({ ...m, licenseType: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              disabled={busy}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {fr ? 'Prix au contrat ($)' : 'Contract price ($)'}
            </span>
            <input
              type="number"
              min={0}
              step={1000}
              value={Number.isFinite(metadata.contractPrice) ? metadata.contractPrice : 0}
              onChange={(e) =>
                setMetadata((m) => ({
                  ...m,
                  contractPrice: Number.parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              disabled={busy}
            />
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-700 sm:w-auto"
          >
            {fr ? 'Annuler' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={
              busy ||
              !metadata.validatedLicenseName.trim() ||
              !metadata.licenseType.trim() ||
              !Number.isFinite(metadata.contractPrice)
            }
            onClick={() => onConfirm(metadata)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white hover:bg-red-800 disabled:opacity-50 sm:w-auto"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {fr ? 'Verrouiller définitivement' : 'Lock permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
