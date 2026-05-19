import React, { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { DocumentShareDraft, DocumentShareRecipient } from '../../../lib/propertyDocumentTaxonomy';

export interface DocumentDistributionPanelProps {
  open: boolean;
  selectedCount: number;
  locale: 'fr' | 'en';
  onClose: () => void;
  onConfirm: (draft: DocumentShareDraft) => void;
  selectedDocumentIds: string[];
}

const RECIPIENT_OPTIONS: Array<{
  id: DocumentShareRecipient;
  labelFr: string;
  labelEn: string;
  hintFr: string;
  hintEn: string;
}> = [
  {
    id: 'acheteur',
    labelFr: "Transmettre à l'Acheteur",
    labelEn: 'Send to buyer',
    hintFr: 'Génère un package sécurisé',
    hintEn: 'Generates a secure package',
  },
  {
    id: 'notaire',
    labelFr: 'Transmettre au Notaire',
    labelEn: 'Send to notary',
    hintFr: 'Routage notarial',
    hintEn: 'Notarial routing',
  },
  {
    id: 'banquier',
    labelFr: 'Transmettre au Banquier',
    labelEn: 'Send to lender',
    hintFr: 'Dossier financement',
    hintEn: 'Financing package',
  },
];

export function DocumentDistributionBar({
  selectedCount,
  locale,
  onOpenPanel,
}: {
  selectedCount: number;
  locale: 'fr' | 'en';
  onOpenPanel: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-0 z-20 border-t border-slate-700/80 bg-slate-950/95 px-4 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold text-slate-300">
          {locale === 'fr'
            ? `${selectedCount} fichier(s) sélectionné(s)`
            : `${selectedCount} file(s) selected`}
        </p>
        <button
          type="button"
          onClick={onOpenPanel}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-slate-900 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:border-amber-400/60 hover:bg-slate-800"
        >
          <Mail className="h-4 w-4" />
          {locale === 'fr' ? 'Transmettre la sélection par courriel' : 'Email selected files'}
        </button>
      </div>
    </div>
  );
}

export function DocumentDistributionPanel({
  open,
  selectedCount,
  locale,
  onClose,
  onConfirm,
  selectedDocumentIds,
}: DocumentDistributionPanelProps) {
  const [recipients, setRecipients] = useState<Set<DocumentShareRecipient>>(new Set());

  if (!open) return null;

  const toggle = (id: DocumentShareRecipient) => {
    setRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="distribution-panel-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="distribution-panel-title" className="text-[13px] font-black text-[#142c6a]">
              {locale === 'fr' ? 'Routage du package documentaire' : 'Document package routing'}
            </h2>
            <p className="mt-1 text-[11px] text-slate-600">
              {locale === 'fr'
                ? `${selectedCount} document(s) — sélectionnez les destinataires (local).`
                : `${selectedCount} document(s) — select recipients (local).`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label={locale === 'fr' ? 'Fermer' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {RECIPIENT_OPTIONS.map((opt) => {
            const checked = recipients.has(opt.id);
            return (
              <li key={opt.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition',
                    checked ? 'border-[#D4AF37]/50 bg-amber-50/80' : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.id)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    <span className="block text-[12px] font-black text-[#142c6a]">
                      {locale === 'fr' ? opt.labelFr : opt.labelEn}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-600">
                      {locale === 'fr' ? opt.hintFr : opt.hintEn}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700"
          >
            {locale === 'fr' ? 'Annuler' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={recipients.size === 0}
            onClick={() => {
              onConfirm({
                documentIds: selectedDocumentIds,
                recipients: [...recipients],
                preparedAtMillis: Date.now(),
              });
              setRecipients(new Set());
              onClose();
            }}
            className="flex-1 rounded-xl bg-[#142c6a] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-40"
          >
            {locale === 'fr' ? 'Préparer l’envoi' : 'Prepare send'}
          </button>
        </div>
      </div>
    </div>
  );
}
