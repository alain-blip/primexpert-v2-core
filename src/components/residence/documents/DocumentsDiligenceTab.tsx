import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../../lib/i18n';
import type { PropertyDocumentCategory, PropertyDocumentRecord } from '../../../types/propertyDocument';
import { canDownloadPropertyDocument } from '../../../lib/propertyDocumentValidation';
import {
  deletePropertyDocument,
  getPropertyDocumentDownloadUrl,
  reconcilePropertyDocumentParses,
  reconcilePropertyDocumentScans,
  subscribeAllPropertyDocuments,
  uploadPropertyDocument,
} from '../../../services/propertyDocumentsService';
import { DocumentCategorySidebar } from './DocumentCategorySidebar';
import { DocumentUploadPanel } from './DocumentUploadPanel';
import { DocumentMetadataPanel } from './DocumentMetadataPanel';

export interface DocumentsDiligenceTabProps {
  propertyId: string;
  brokerId: string;
  /** UID courtier assigné sur la fiche (`courtiersResponsables`). */
  courtiersResponsables?: string;
}

function canUploadToResidence(brokerId: string, courtiersResponsables?: string): boolean {
  return Boolean(brokerId) && courtiersResponsables === brokerId;
}

const EMPTY_COUNTS: Record<PropertyDocumentCategory, number> = {
  financier: 0,
  technique: 0,
  legal: 0,
};

export function DocumentsDiligenceTab({
  propertyId,
  brokerId,
  courtiersResponsables,
}: DocumentsDiligenceTabProps) {
  const { language, t } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const uploadAllowed = canUploadToResidence(brokerId, courtiersResponsables);

  const [category, setCategory] = useState<PropertyDocumentCategory>('financier');
  const [allDocs, setAllDocs] = useState<PropertyDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasPendingScan = useMemo(
    () => allDocs.some((d) => d.virusScanStatus === 'pending'),
    [allDocs]
  );

  const hasPendingParse = useMemo(
    () =>
      allDocs.some((d) => d.virusScanStatus === 'clean' && d.parsingStatus === 'pending'),
    [allDocs]
  );

  useEffect(() => {
    if (!propertyId || !uploadAllowed || !hasPendingScan) return;

    let cancelled = false;
    void reconcilePropertyDocumentScans(propertyId)
      .then((r) => {
        if (!cancelled && r.processed > 0) {
          console.info('[DocumentsDiligenceTab] scan reconciled', r);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.warn('[DocumentsDiligenceTab] reconcile scan failed', e);
          setError(
            t(
              'La vérification automatique a échoué. Réessayez en rafraîchissant la page.',
              'Automatic verification failed. Try refreshing the page.'
            )
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [propertyId, uploadAllowed, hasPendingScan, t]);

  useEffect(() => {
    if (!propertyId || !uploadAllowed || !hasPendingParse) return;

    let cancelled = false;
    void reconcilePropertyDocumentParses(propertyId)
      .then((r) => {
        if (!cancelled && r.processed > 0) {
          console.info('[DocumentsDiligenceTab] IA parse reconciled', r);
        }
      })
      .catch((e) => {
        if (!cancelled) console.warn('[DocumentsDiligenceTab] reconcile parse failed', e);
      });
    return () => {
      cancelled = true;
    };
  }, [propertyId, uploadAllowed, hasPendingParse]);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAllPropertyDocuments(
      propertyId,
      (rows) => {
        setAllDocs(rows);
        setLoading(false);
      },
      () => {
        setError(
          t(
            'Impossible de charger les documents. Vérifiez votre connexion.',
            'Unable to load documents. Check your connection.'
          )
        );
        setLoading(false);
      }
    );
    return unsub;
  }, [propertyId, t]);

  const counts = useMemo(() => {
    const next = { ...EMPTY_COUNTS };
    for (const doc of allDocs) {
      if (doc.category in next) next[doc.category] += 1;
    }
    return next;
  }, [allDocs]);

  const categoryDocs = useMemo(
    () => allDocs.filter((d) => d.category === category),
    [allDocs, category]
  );

  const selected = useMemo(
    () => categoryDocs.find((d) => d.id === selectedId) ?? null,
    [categoryDocs, selectedId]
  );

  useEffect(() => {
    if (selectedId && !categoryDocs.some((d) => d.id === selectedId)) {
      setSelectedId(categoryDocs[0]?.id ?? null);
    }
  }, [category, categoryDocs, selectedId]);

  useEffect(() => {
    setSelectedId(null);
  }, [category]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (!uploadAllowed) {
        setError(
          t(
            'Téléversement impossible : vous devez être le courtier responsable de cette fiche (catalogue partagé non assigné).',
            'Upload not allowed: you must be the assigned broker for this listing (unassigned shared catalog).'
          )
        );
        return;
      }
      setUploading(true);
      setError(null);
      try {
        let last: PropertyDocumentRecord | null = null;
        for (const file of files) {
          last = await uploadPropertyDocument({
            propertyId,
            category,
            file,
            uploadedBy: brokerId,
          });
        }
        if (last) setSelectedId(last.id);
      } catch (e) {
        console.error('[DocumentsDiligenceTab] upload failed', e);
        const msg = e instanceof Error ? e.message : '';
        if (msg.startsWith('VALIDATION_')) {
          setError(
            t(
              'Fichier refusé par la politique de sécurité. Formats acceptés : document portable (PDF), tableur Excel (XLSX/XLS), document Word (DOCX).',
              'File rejected by security policy. Accepted: portable document format (PDF), Excel spreadsheet (XLSX/XLS), Word document (DOCX).'
            )
          );
        } else {
          setError(
            t(
              'Échec du téléversement. Vérifiez les droits d’accès et la taille du fichier (max. 25 Mo).',
              'Upload failed. Check access rights and file size (max 25 MB).'
            )
          );
        }
      } finally {
        setUploading(false);
      }
    },
    [propertyId, category, brokerId, t, uploadAllowed]
  );

  const handleDownload = useCallback(
    async (doc: PropertyDocumentRecord) => {
      if (!canDownloadPropertyDocument(doc.virusScanStatus)) {
        setError(
          t(
            'Téléchargement bloqué : vérification de sécurité en cours ou fichier non conforme.',
            'Download blocked: security verification in progress or file not cleared.'
          )
        );
        return;
      }
      setBusyAction(true);
      setError(null);
      try {
        const url = await getPropertyDocumentDownloadUrl(doc.storagePath);
        const anchor = window.document.createElement('a');
        anchor.href = url;
        anchor.download = doc.fileName;
        anchor.rel = 'noopener noreferrer';
        anchor.target = '_blank';
        anchor.click();
      } catch (e) {
        console.error('[DocumentsDiligenceTab] download failed', e);
        setError(t('Téléchargement impossible.', 'Download failed.'));
      } finally {
        setBusyAction(false);
      }
    },
    [t]
  );

  const handleDelete = useCallback(
    async (doc: PropertyDocumentRecord) => {
      setBusyAction(true);
      setError(null);
      try {
        await deletePropertyDocument(propertyId, doc);
        if (selectedId === doc.id) setSelectedId(null);
      } catch (e) {
        console.error('[DocumentsDiligenceTab] delete failed', e);
        setError(t('Suppression impossible.', 'Delete failed.'));
      } finally {
        setBusyAction(false);
      }
    },
    [propertyId, selectedId, t]
  );

  const uploadLabels = useMemo(
    () =>
      locale === 'fr'
        ? {
            dropTitle: 'Glissez-déposez vos fichiers ici',
            dropHint:
              'document portable (PDF), tableur Excel (XLSX/XLS), document Word (DOCX) — max. 25 Mo',
            browse: 'Parcourir',
            uploadedTitle: 'Fichiers du dossier',
            empty: 'Aucun fichier dans ce dossier.',
            loading: 'Chargement…',
          }
        : {
            dropTitle: 'Drag and drop files here',
            dropHint:
              'portable document format (PDF), Excel spreadsheet (XLSX/XLS), Word document (DOCX) — max 25 MB',
            browse: 'Browse',
            uploadedTitle: 'Folder files',
            empty: 'No files in this folder.',
            loading: 'Loading…',
          },
    [locale]
  );

  const metaLabels = useMemo(
    () =>
      locale === 'fr'
        ? {
            title: 'Métadonnées',
            empty: 'Sélectionnez un fichier pour voir ses détails.',
            name: 'Nom',
            size: 'Taille',
            date: 'Date de téléversement',
            type: 'Type de contenu',
            security: 'Sécurité',
            analysis: 'Analyse intelligente',
            securityPendingNote:
              'Vérification de sécurité en cours. Le téléchargement sera disponible une fois le fichier validé.',
            securityInfectedNote:
              'Ce fichier a été signalé comme infecté. Il ne peut pas être téléchargé.',
            downloadBlocked:
              'Téléchargement indisponible tant que la vérification de sécurité n’est pas terminée.',
            download: 'Télécharger',
            delete: 'Supprimer',
            confirmDelete: 'Confirmer la suppression définitive de ce fichier ?',
          }
        : {
            title: 'Metadata',
            empty: 'Select a file to view its details.',
            name: 'Name',
            size: 'Size',
            date: 'Upload date',
            type: 'Content type',
            security: 'Security',
            analysis: 'Intelligent analysis',
            securityPendingNote:
              'Security verification in progress. Download will be available once the file is cleared.',
            securityInfectedNote: 'This file was flagged as infected. It cannot be downloaded.',
            downloadBlocked: 'Download unavailable until security verification is complete.',
            download: 'Download',
            delete: 'Delete',
            confirmDelete: 'Permanently delete this file?',
          },
    [locale]
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">
            {t('Espace Documents — diligence raisonnable', 'Document space — due diligence')}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            {t(
              'Dossiers institutionnels : financier, technique et légal.',
              'Institutional folders: financial, technical, and legal.'
            )}
          </p>
        </div>
      </div>

      {!uploadAllowed ? (
        <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950" role="status">
          {t(
            'Cette fiche n’est pas assignée à votre compte. Assignez-vous comme courtier responsable avant de téléverser des documents.',
            'This listing is not assigned to your account. Assign yourself as responsible broker before uploading documents.'
          )}
        </p>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-[520px] gap-4">
        <DocumentCategorySidebar
          activeCategory={category}
          onCategoryChange={setCategory}
          counts={counts}
          locale={locale}
          title={t('Dossiers', 'Folders')}
        />
        <DocumentUploadPanel
          documents={categoryDocs}
          selectedId={selectedId}
          loading={loading}
          uploading={uploading}
          uploadDisabled={!uploadAllowed}
          onSelect={(doc) => setSelectedId(doc.id)}
          onUpload={handleUpload}
          locale={locale}
          labels={uploadLabels}
        />
        <DocumentMetadataPanel
          document={selected}
          locale={locale}
          busy={busyAction}
          onDownload={handleDownload}
          onDelete={handleDelete}
          labels={metaLabels}
        />
      </div>
    </div>
  );
}
