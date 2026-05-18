import React, { useMemo, useState } from 'react';
import { Download, FileText, Loader2, Shield, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { canDownloadPropertyDocument } from '../../../lib/propertyDocumentValidation';
import type { PropertyDocumentRecord } from '../../../types/propertyDocument';
import { inst } from '../institutional/InstitutionalUi';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(ms: number, locale: 'fr' | 'en'): string {
  return new Date(ms).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'amber' | 'emerald' | 'red' | 'slate' | 'blue';
  children: React.ReactNode;
}) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold leading-snug',
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function securityBadge(doc: PropertyDocumentRecord, locale: 'fr' | 'en') {
  switch (doc.virusScanStatus) {
    case 'clean':
      return (
        <StatusBadge tone="emerald">
          {locale === 'fr' ? '✅ Fichier sain' : '✅ File verified clean'}
        </StatusBadge>
      );
    case 'infected':
      return (
        <StatusBadge tone="red">
          {locale === 'fr' ? '⛔ Fichier infecté — accès bloqué' : '⛔ Infected file — access blocked'}
        </StatusBadge>
      );
    default:
      return (
        <StatusBadge tone="amber">
          {locale === 'fr' ? '🛡️ Vérification en cours…' : '🛡️ Security scan in progress…'}
        </StatusBadge>
      );
  }
}

function parsingBadge(doc: PropertyDocumentRecord, locale: 'fr' | 'en') {
  if (!doc.parsingEligible) {
    return (
      <StatusBadge tone="slate">
        {locale === 'fr' ? 'Analyse IA : non applicable' : 'AI analysis: not applicable'}
      </StatusBadge>
    );
  }

  switch (doc.parsingStatus) {
    case 'completed':
      return (
        <StatusBadge tone="emerald">
          {locale === 'fr' ? '📊 Données extraites' : '📊 Data extracted'}
        </StatusBadge>
      );
    case 'failed':
      return (
        <StatusBadge tone="red">
          {locale === 'fr' ? 'Analyse IA échouée' : 'AI analysis failed'}
        </StatusBadge>
      );
    case 'pending':
      return (
        <StatusBadge tone="blue">
          {locale === 'fr' ? '🧠 Analyse du document…' : '🧠 Analyzing document…'}
        </StatusBadge>
      );
    default:
      if (doc.virusScanStatus !== 'clean') {
        return (
          <StatusBadge tone="slate">
            {locale === 'fr'
              ? 'Analyse IA : en attente du scan antivirus'
              : 'AI analysis: waiting for antivirus scan'}
          </StatusBadge>
        );
      }
      return (
        <StatusBadge tone="slate">
          {locale === 'fr' ? 'Analyse IA : en file d’attente' : 'AI analysis: queued'}
        </StatusBadge>
      );
  }
}

export interface DocumentMetadataPanelProps {
  document: PropertyDocumentRecord | null;
  locale: 'fr' | 'en';
  busy: boolean;
  onDownload: (doc: PropertyDocumentRecord) => Promise<void>;
  onDelete: (doc: PropertyDocumentRecord) => Promise<void>;
  labels: {
    title: string;
    empty: string;
    name: string;
    size: string;
    date: string;
    type: string;
    security: string;
    analysis: string;
    securityPendingNote: string;
    securityInfectedNote: string;
    downloadBlocked: string;
    download: string;
    delete: string;
    confirmDelete: string;
  };
}

export function DocumentMetadataPanel({
  document,
  locale,
  busy,
  onDownload,
  onDelete,
  labels,
}: DocumentMetadataPanelProps) {
  const [confirming, setConfirming] = useState(false);

  const downloadAllowed = useMemo(
    () => (document ? canDownloadPropertyDocument(document.virusScanStatus) : false),
    [document]
  );

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className={inst.sectionHeader}>
        <h3 className={inst.sectionTitle}>{labels.title}</h3>
      </header>

      {!document ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <FileText className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">{labels.empty}</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="space-y-2 border-b border-slate-100 px-5 py-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{labels.security}</p>
            {securityBadge(document, locale)}
            <p className="mt-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{labels.analysis}</p>
            {parsingBadge(document, locale)}
          </div>

          {document.virusScanStatus === 'pending' ? (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-[11px] text-amber-950">{labels.securityPendingNote}</p>
            </div>
          ) : null}

          {document.virusScanStatus === 'infected' ? (
            <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-900">
              {labels.securityInfectedNote}
            </div>
          ) : null}

          <dl className="space-y-4 px-5 py-4">
            <div>
              <dt className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{labels.name}</dt>
              <dd className="mt-1 break-words text-[12px] font-semibold text-[#000000]">{document.fileName}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{labels.size}</dt>
              <dd className="mt-1 font-mono text-[12px] text-slate-800">{formatSize(document.sizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{labels.date}</dt>
              <dd className="mt-1 text-[12px] text-slate-800">
                {formatDate(document.uploadedAtMillis, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{labels.type}</dt>
              <dd className="mt-1 break-all text-[11px] text-slate-600">{document.mimeType}</dd>
            </div>

            {document.parsingStatus === 'completed' && document.extractedData ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-900">
                  {locale === 'fr' ? 'Extraction IA' : 'AI extraction'}
                </p>
                <p className="mt-1 text-[11px] text-emerald-950">
                  {(document.extractedData.amounts?.length ?? 0) > 0
                    ? locale === 'fr'
                      ? `${document.extractedData.amounts?.length} montant(s) détecté(s)`
                      : `${document.extractedData.amounts?.length} amount(s) detected`
                    : locale === 'fr'
                      ? 'Données structurées enregistrées'
                      : 'Structured data saved'}
                </p>
              </div>
            ) : null}
          </dl>

          <div className="mt-auto space-y-2 border-t border-slate-200 p-4">
            {!downloadAllowed ? (
              <p className="text-center text-[10px] font-semibold text-amber-800">{labels.downloadBlocked}</p>
            ) : null}
            <button
              type="button"
              disabled={busy || !downloadAllowed}
              onClick={() => void onDownload(document)}
              title={!downloadAllowed ? labels.downloadBlocked : undefined}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5',
                'text-[10px] font-black uppercase tracking-widest text-slate-800',
                'hover:border-[#D4AF37]/50 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {labels.download}
            </button>

            {!confirming ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {labels.delete}
              </button>
            ) : (
              <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-[11px] text-red-900">{labels.confirmDelete}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(false)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-700"
                  >
                    {locale === 'fr' ? 'Annuler' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void onDelete(document).finally(() => setConfirming(false));
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-700 px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-white"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    {labels.delete}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
