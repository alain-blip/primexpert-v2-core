import React, { useRef, useState } from 'react';
import { Upload, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import type { ContactCriteriaDocumentRef } from '@primexpert/core/crm';
import type { ContactServiceContext } from '../../services/contacts';

export interface CriteriaDocumentRowConfig<K extends string = string> {
  kind: K;
  labelFr: string;
  labelEn: string;
  file?: ContactCriteriaDocumentRef;
}

export type CriteriaDocumentUploadFn<K extends string = string> = (
  ctx: ContactServiceContext,
  contactId: string,
  kind: K,
  file: File
) => Promise<
  | { ok: true; ref: ContactCriteriaDocumentRef }
  | { ok: false; error: string }
>;

export interface ContactCriteriaDocumentsSectionProps<K extends string = string> {
  ctx: ContactServiceContext;
  contactId: string | undefined;
  rows: CriteriaDocumentRowConfig<K>[];
  uploadDocument: CriteriaDocumentUploadFn<K>;
  onDocumentUploaded: (kind: K, ref: ContactCriteriaDocumentRef) => void;
  legendFr?: string;
  legendEn?: string;
  className?: string;
}

export function ContactCriteriaDocumentsSection<K extends string = string>({
  ctx,
  contactId,
  rows,
  uploadDocument,
  onDocumentUploaded,
  legendFr = 'Documents vérifiés',
  legendEn = 'Verified documents',
  className,
}: ContactCriteriaDocumentsSectionProps<K>) {
  const { t, language } = useLanguage();
  const isFr = language === 'fr';
  const [pendingKind, setPendingKind] = useState<K | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingKindRef = useRef<K | null>(null);

  const openPicker = (kind: K) => {
    if (!contactId) {
      setError(
        t(
          'Enregistrez le contact avant de téléverser une pièce.',
          'Save the contact before uploading a document.'
        )
      );
      return;
    }
    setError(null);
    pendingKindRef.current = kind;
    inputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    const kind = pendingKindRef.current;
    if (!kind || !contactId) return;
    setPendingKind(kind);
    setError(null);
    try {
      const res = await uploadDocument(ctx, contactId, kind, file);
      if (!res.ok) {
        setError(
          t('Téléversement refusé — vérifiez vos permissions.', 'Upload denied — check permissions.')
        );
        return;
      }
      onDocumentUploaded(kind, res.ref);
    } catch {
      setError(t('Erreur de téléversement.', 'Upload error.'));
    } finally {
      setPendingKind(null);
      pendingKindRef.current = null;
    }
  };

  return (
    <fieldset
      className={cn(
        'space-y-2 rounded-lg border-2 border-primexpert-dark/15 bg-primexpert-light/50 p-3',
        className
      )}
    >
      <legend className="text-[11px] font-black uppercase tracking-widest text-primexpert-dark px-1">
        {t(legendFr, legendEn)}
      </legend>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      {rows.map((row) => {
        const label = isFr ? row.labelFr : row.labelEn;
        const busy = pendingKind === row.kind;
        return (
          <div
            key={row.kind}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primexpert-dark/15 bg-white px-3 py-2"
          >
            <span className="text-sm font-semibold text-primexpert-dark leading-snug flex-1 min-w-[12rem]">
              {label}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {row.file?.url ? (
                <a
                  href={row.file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-primexpert-blue px-2 py-1 text-[10px] font-black uppercase text-primexpert-blue hover:bg-primexpert-blue hover:text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('Voir', 'View')}
                </a>
              ) : (
                <span className="text-[10px] font-bold text-primexpert-dark/50 uppercase">
                  {t('Aucun fichier', 'No file')}
                </span>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => openPicker(row.kind)}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-primexpert-dark bg-primexpert-light px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primexpert-dark hover:bg-primexpert-dark hover:text-white disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {t('Téléverser', 'Upload')}
              </button>
            </div>
          </div>
        );
      })}
      {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
    </fieldset>
  );
}
