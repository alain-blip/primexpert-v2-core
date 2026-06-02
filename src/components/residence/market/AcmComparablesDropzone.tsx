/**
 * Ingestion instantanée de comparables vendus (Centris PDF) — analyse comparative
 * de marché (ACM) résidentielle (contexte `propertyContext === 'RESIDENTIAL'`).
 *
 * Réutilise le pipeline SSOT documentaire : `uploadAcmComparablePdfs` téléverse sous
 * `…/documents/acm_comparables/` puis déclenche scan antivirus + Cloud Function
 * `propertyDocumentParseIA`. Aucune nouvelle collection Firestore.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Loader2, FileCheck, AlertCircle, FileSearch, FileX } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../lib/auth';
import { useLanguage } from '../../../lib/i18n';
import {
  ACM_COMPARABLES_CATEGORY,
  ACM_COMPARABLES_MAX_FILES,
  subscribeAllPropertyDocuments,
  uploadAcmComparablePdfs,
  type PropertyDocumentRecord,
} from '../../../services/propertyDocumentsService';
import {
  institutionalListingsCardShellClass,
  institutionalListingsCardHeaderClass,
  institutionalListingsCardTitleClass,
} from '../../../lib/institutionalTheme';

export interface AcmComparablesDropzoneProps {
  propertyId: string;
  /** Courtier responsable de la fiche (cloison multi-tenant). */
  brokerId?: string;
}

type ParseState = 'scanning' | 'analyzing' | 'done' | 'failed';

function resolveParseState(doc: PropertyDocumentRecord): ParseState {
  if (doc.virusScanStatus === 'infected' || doc.parsingStatus === 'failed') return 'failed';
  if (doc.parsingStatus === 'completed' || doc.parsingStatus === 'verified') return 'done';
  if (doc.virusScanStatus === 'pending') return 'scanning';
  return 'analyzing';
}

export function AcmComparablesDropzone({ propertyId, brokerId }: AcmComparablesDropzoneProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const effectiveBrokerId = brokerId ?? profile?.uid ?? '';

  const [docs, setDocs] = useState<PropertyDocumentRecord[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!propertyId) {
      setDocs([]);
      return;
    }
    return subscribeAllPropertyDocuments(
      propertyId,
      (rows) => setDocs(rows.filter((d) => d.category === ACM_COMPARABLES_CATEGORY)),
      () => setDocs([])
    );
  }, [propertyId]);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      if (!effectiveBrokerId) {
        setError(
          t(
            'Courtier responsable requis pour téléverser des comparables.',
            'Responsible broker required to upload comparables.'
          )
        );
        return;
      }
      setUploading(true);
      setError(null);
      setNotice(null);
      try {
        const files = Array.from(fileList);
        const { uploaded, rejected } = await uploadAcmComparablePdfs({
          propertyId,
          brokerId: effectiveBrokerId,
          files,
        });
        const notPdf = rejected.filter((r) => r.reason === 'not_pdf').length;
        const overLimit = rejected.filter((r) => r.reason === 'over_limit').length;
        const failed = rejected.filter((r) => r.reason === 'failed').length;
        const parts: string[] = [];
        if (uploaded.length > 0) {
          parts.push(
            t(
              `${uploaded.length} comparable(s) en cours d’analyse.`,
              `${uploaded.length} comparable(s) being analyzed.`
            )
          );
        }
        if (notPdf > 0) {
          parts.push(
            t(`${notPdf} fichier(s) ignoré(s) (PDF requis).`, `${notPdf} file(s) skipped (PDF required).`)
          );
        }
        if (overLimit > 0) {
          parts.push(
            t(
              `${overLimit} fichier(s) au-delà de la limite de ${ACM_COMPARABLES_MAX_FILES}.`,
              `${overLimit} file(s) beyond the ${ACM_COMPARABLES_MAX_FILES} limit.`
            )
          );
        }
        if (failed > 0) {
          parts.push(t(`${failed} échec(s) de téléversement.`, `${failed} upload failure(s).`));
        }
        setNotice(parts.join(' '));
      } catch (e) {
        console.error('[AcmComparablesDropzone] upload failed', e);
        setError(t('Échec du téléversement des comparables.', 'Comparables upload failed.'));
      } finally {
        setUploading(false);
      }
    },
    [propertyId, effectiveBrokerId, t]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const remaining = Math.max(0, ACM_COMPARABLES_MAX_FILES - docs.length);

  const stateLabel = useMemo(
    () => ({
      scanning: t('Vérification de sécurité…', 'Security verification…'),
      analyzing: t('Analyse intelligente en cours…', 'Intelligent analysis in progress…'),
      done: t('Caractéristiques extraites', 'Features extracted'),
      failed: t('Échec — relancez ou remplacez le PDF', 'Failed — retry or replace the PDF'),
    }),
    [t]
  );

  return (
    <section className={institutionalListingsCardShellClass} aria-labelledby="acm-comparables-heading">
      <header className={institutionalListingsCardHeaderClass}>
        <div>
          <p className={institutionalListingsCardTitleClass}>
            {t('Analyse comparative de marché (ACM) — résidentiel', 'Comparative market analysis (CMA) — residential')}
          </p>
          <h3
            id="acm-comparables-heading"
            className="mt-1 text-xl font-black uppercase tracking-tight text-black"
          >
            {t(
              'Ingestion instantanée de comparables vendus (Centris PDF)',
              'Instant ingestion of sold comparables (Centris PDF)'
            )}
          </h3>
        </div>
      </header>

      <div className="space-y-4 p-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
            dragging
              ? 'border-primexpert-blue bg-primexpert-light'
              : 'border-primexpert-dark/30 bg-primexpert-light/60 hover:border-primexpert-dark/60',
            uploading && 'pointer-events-none opacity-60'
          )}
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-primexpert-dark" aria-hidden />
          ) : (
            <Upload className="h-7 w-7 text-primexpert-dark" aria-hidden />
          )}
          <p className="text-sm font-black text-black">
            {t(
              'Glissez-déposez jusqu’à 11 PDF Centris (1 propriété sujet + 10 comparables vendus)',
              'Drag and drop up to 11 Centris PDFs (1 subject property + 10 sold comparables)'
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-700">
            {t(
              `Document portable (PDF) uniquement · ${remaining} emplacement(s) restant(s)`,
              `Portable document (PDF) only · ${remaining} slot(s) remaining`
            )}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {notice ? (
          <p className="rounded-xl border-2 border-primexpert-dark/15 bg-primexpert-light px-4 py-2 text-[12px] font-semibold text-slate-900">
            {notice}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-900"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        {docs.length > 0 ? (
          <ul className="space-y-2">
            {docs.map((doc) => {
              const state = resolveParseState(doc);
              const Icon =
                state === 'done'
                  ? FileCheck
                  : state === 'failed'
                    ? FileX
                    : state === 'analyzing'
                      ? FileSearch
                      : Loader2;
              return (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-primexpert-dark/12 bg-white px-4 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        state === 'done' && 'text-emerald-700',
                        state === 'failed' && 'text-red-700',
                        (state === 'scanning' || state === 'analyzing') &&
                          'text-primexpert-dark',
                        state === 'scanning' && 'animate-spin'
                      )}
                      aria-hidden
                    />
                    <span className="truncate text-[12px] font-bold text-black" title={doc.fileName}>
                      {doc.fileName}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-[10px] font-black uppercase tracking-widest',
                      state === 'done' && 'text-emerald-800',
                      state === 'failed' && 'text-red-800',
                      (state === 'scanning' || state === 'analyzing') && 'text-slate-700'
                    )}
                  >
                    {stateLabel[state]}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
