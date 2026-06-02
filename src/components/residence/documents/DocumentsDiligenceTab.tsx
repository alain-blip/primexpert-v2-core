import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth';
import type { PropertyDocumentRecord } from '../../../types/propertyDocument';
import type { AssetNiche } from '../../../types/residence';
import {
  hasExtractedFinancialAmounts,
  sortDocumentsByFileName,
} from '../../../lib/extractedDataInjection';
import { useFinancialHubDraft } from '../../../context/FinancialHubDraftContext';
import {
  canDownloadPropertyDocument,
  documentNeedsIaParse,
} from '../../../lib/propertyDocumentValidation';
import {
  filterDocsForTab,
  isPromesseTab,
  tabToUploadCategory,
  TRANSACTION_DOCUMENT_TABS,
  type TransactionDocumentTab,
} from '../../../lib/propertyDocumentTaxonomy';
import {
  deletePropertyDocument,
  getPropertyDocumentDownloadUrl,
  reconcilePropertyDocumentCategories,
  reconcilePropertyDocumentParses,
  reconcilePropertyDocumentScans,
  subscribeAllPropertyDocuments,
  uploadPropertyDocument,
} from '../../../services/propertyDocumentsService';
import { DocumentTabs } from './DocumentTabs';
import { DocumentUploadPanel } from './DocumentUploadPanel';
import { DocumentMetadataPanel } from './DocumentMetadataPanel';
import { DocumentDistributionBar } from './DocumentDistributionPanel';
import { DocumentEmailPanel } from './DocumentEmailPanel';
import {
  subscribeLegalVaultByProperty,
  type LegalVaultFirestoreRecord,
} from '../../../services/legalVaultService';

export interface DocumentsDiligenceTabProps {
  propertyId: string;
  brokerId: string;
  courtiersResponsables?: string;
  residenceCity?: string;
  residenceRegionHint?: string;
  assetNiche?: AssetNiche;
  propertyType?: string;
  contractPrice?: number;
}

function canUploadToResidence(brokerId: string, courtiersResponsables?: string): boolean {
  return Boolean(brokerId) && courtiersResponsables === brokerId;
}

const EMPTY_TAB_COUNTS: Record<TransactionDocumentTab, number> = {
  acheteurs: 0,
  contrats: 0,
  actes: 0,
  promesses: 0,
};

export function DocumentsDiligenceTab({
  propertyId,
  brokerId,
  courtiersResponsables,
  residenceCity,
  residenceRegionHint,
  assetNiche,
  propertyType,
  contractPrice = 0,
}: DocumentsDiligenceTabProps) {
  const { language, t } = useLanguage();
  const { profile } = useAuth();
  const orgId = profile?.orgId ?? '';
  const licenseName = profile?.licenseName ?? profile?.displayName ?? '';
  const licenseTitle = profile?.title;
  const locale = language === 'fr' ? 'fr' : 'en';
  const uploadAllowed = canUploadToResidence(brokerId, courtiersResponsables);

  const [activeTab, setActiveTab] = useState<TransactionDocumentTab>('acheteurs');
  const [allDocs, setAllDocs] = useState<PropertyDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultByDocId, setVaultByDocId] = useState<Record<string, LegalVaultFirestoreRecord>>({});
  const iaPrefillQueuedDocIds = useRef(new Set<string>());
  const { queueIaPrefill } = useFinancialHubDraft();

  const hasPendingScan = useMemo(
    () => allDocs.some((d) => d.virusScanStatus === 'pending'),
    [allDocs]
  );

  const hasPendingParse = useMemo(() => allDocs.some(documentNeedsIaParse), [allDocs]);

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
        // Les comparables ACM (Centris PDF) sont hermétiques : masqués de la vue diligence.
        const visibleRows = rows.filter((d) => d.category !== 'acm_comparables');
        setAllDocs(visibleRows);
        setLoading(false);
        if (uploadAllowed) {
          void reconcilePropertyDocumentCategories(propertyId, visibleRows)
            .then((count) => {
              if (count > 0) {
                console.info('[DocumentsDiligenceTab] taxonomy categories reconciled', { count });
              }
            })
            .catch((e) => {
              console.warn('[DocumentsDiligenceTab] taxonomy category reconcile failed', e);
            });
        }
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
  }, [propertyId, t, uploadAllowed]);

  useEffect(() => {
    if (!orgId || !propertyId) {
      setVaultByDocId({});
      return undefined;
    }
    return subscribeLegalVaultByProperty(orgId, propertyId, setVaultByDocId);
  }, [orgId, propertyId]);

  const wormLockedByDocId = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const [docId, record] of Object.entries(vaultByDocId)) {
      map[docId] = record.isFinalWormLocked === true;
    }
    return map;
  }, [vaultByDocId]);

  /** Post-analyse IA : pré-remplit le panneau Saisie manuelle (aucune écriture Firestore). */
  useEffect(() => {
    if (!propertyId || !uploadAllowed) return;
    for (const doc of allDocs) {
      if (doc.parsingStatus !== 'completed') continue;
      if (iaPrefillQueuedDocIds.current.has(doc.id)) continue;
      if (!hasExtractedFinancialAmounts(doc.extractedData)) continue;

      iaPrefillQueuedDocIds.current.add(doc.id);
      queueIaPrefill(doc.extractedData, { documentId: doc.id, fileName: doc.fileName });
    }
  }, [allDocs, propertyId, uploadAllowed, queueIaPrefill]);

  const tabCounts = useMemo(() => {
    const next = { ...EMPTY_TAB_COUNTS };
    for (const tab of TRANSACTION_DOCUMENT_TABS) {
      next[tab.id] = filterDocsForTab(allDocs, tab.id).length;
    }
    return next;
  }, [allDocs]);

  const tabDocs = useMemo(
    () => sortDocumentsByFileName(filterDocsForTab(allDocs, activeTab)),
    [allDocs, activeTab]
  );

  const selected = useMemo(
    () => tabDocs.find((d) => d.id === selectedId) ?? null,
    [tabDocs, selectedId]
  );

  const selectedDocumentIds = useMemo(
    () =>
      tabDocs
        .filter((d) => checkedIds.has(d.id))
        .map((d) => (d.id.includes(':') ? d.id : `property:${d.id}`)),
    [tabDocs, checkedIds]
  );

  const propertyContextLabel = useMemo(() => {
    if (residenceCity) return residenceCity;
    return undefined;
  }, [residenceCity]);

  useEffect(() => {
    if (selectedId && !tabDocs.some((d) => d.id === selectedId)) {
      setSelectedId(tabDocs[0]?.id ?? null);
    }
  }, [activeTab, tabDocs, selectedId]);

  useEffect(() => {
    setSelectedId(null);
    setCheckedIds(new Set());
  }, [activeTab]);

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCheckAll = useCallback((ids: string[], checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const activeTabDef = TRANSACTION_DOCUMENT_TABS.find((t) => t.id === activeTab);

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (!uploadAllowed) {
        setError(
          t(
            'Téléversement impossible : vous devez être le courtier responsable de cette fiche.',
            'Upload not allowed: you must be the assigned broker for this listing.'
          )
        );
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const category = tabToUploadCategory(activeTab);
        const promesse = isPromesseTab(activeTab);
        let last: PropertyDocumentRecord | null = null;
        for (const file of files) {
          last = await uploadPropertyDocument({
            propertyId,
            category,
            file,
            uploadedBy: brokerId,
            promesseScope: promesse,
            promesseDocLabel: promesse ? file.name : undefined,
          });
        }
        if (last) setSelectedId(last.id);
      } catch (e) {
        console.error('[DocumentsDiligenceTab] upload failed', e);
        const msg = e instanceof Error ? e.message : '';
        if (msg.startsWith('VALIDATION_')) {
          setError(
            t(
              'Fichier refusé par la politique de sécurité. Formats acceptés : PDF, Excel, Word.',
              'File rejected by security policy. Accepted: PDF, Excel, Word.'
            )
          );
        } else {
          setError(t('Échec du téléversement.', 'Upload failed.'));
        }
      } finally {
        setUploading(false);
      }
    },
    [propertyId, activeTab, brokerId, t, uploadAllowed]
  );

  const handleDownload = useCallback(
    async (doc: PropertyDocumentRecord) => {
      if (!canDownloadPropertyDocument(doc.virusScanStatus)) {
        setError(
          t(
            'Téléchargement bloqué : vérification de sécurité en cours.',
            'Download blocked: security verification in progress.'
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
      } catch {
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
        setCheckedIds((prev) => {
          const next = new Set(prev);
          next.delete(doc.id);
          return next;
        });
      } catch {
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
            dropHint: 'PDF, Excel (XLSX/XLS), Word (DOCX) — max. 25 Mo',
            browse: 'Parcourir',
            uploadedTitle: 'Fichiers du dossier',
            empty: 'Aucun fichier dans cet onglet.',
            loading: 'Chargement…',
          }
        : {
            dropTitle: 'Drag and drop files here',
            dropHint: 'PDF, Excel (XLSX/XLS), Word (DOCX) — max 25 MB',
            browse: 'Browse',
            uploadedTitle: 'Folder files',
            empty: 'No files in this tab.',
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
            taxonomy: 'Type documentaire (IA)',
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
            taxonomy: 'Document type (AI)',
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
    <div className="p-4">
      {activeTabDef ? (
        <p className="mb-4 px-1 text-[11px] font-medium text-[#142c6a] leading-relaxed">
          {locale === 'fr' ? activeTabDef.descriptionFr : activeTabDef.descriptionEn}
        </p>
      ) : null}

      {!uploadAllowed ? (
        <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950" role="status">
          {t(
            'Assignez-vous comme courtier responsable avant de téléverser des documents.',
            'Assign yourself as responsible broker before uploading documents.'
          )}
        </p>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="relative flex min-h-[520px] flex-col gap-0">
        <div className="flex min-h-0 flex-1 flex-col gap-4 pb-16 lg:flex-row">
          <DocumentTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={tabCounts}
            locale={locale}
          />
          <DocumentUploadPanel
            documents={tabDocs}
            selectedId={selectedId}
            checkedIds={checkedIds}
            onToggleCheck={toggleCheck}
            onToggleCheckAll={toggleCheckAll}
            activeTab={activeTab}
            loading={loading}
            uploading={uploading}
            uploadDisabled={!uploadAllowed}
            onSelect={(doc) => setSelectedId(doc.id)}
            onUpload={handleUpload}
            locale={locale}
            labels={uploadLabels}
            wormLockedByDocId={wormLockedByDocId}
            wormIndicatorsEnabled={Boolean(orgId)}
          />
          <DocumentMetadataPanel
            document={selected}
            propertyId={propertyId}
            brokerId={brokerId}
            orgId={orgId}
            licenseName={licenseName}
            licenseTitle={licenseTitle}
            contractPrice={contractPrice}
            vaultRecord={selected ? vaultByDocId[selected.id] ?? null : null}
            residenceCity={residenceCity}
            residenceRegionHint={residenceRegionHint}
            assetNiche={assetNiche}
            propertyType={propertyType}
            locale={locale}
            busy={busyAction}
            onDownload={handleDownload}
            onDelete={handleDelete}
            labels={metaLabels}
          />
        </div>

        <DocumentDistributionBar
          selectedCount={selectedDocumentIds.length}
          locale={locale}
          onOpenPanel={() => setEmailPanelOpen(true)}
        />
      </div>

      <DocumentEmailPanel
        open={emailPanelOpen}
        locale={locale}
        documentIds={selectedDocumentIds}
        propertyId={propertyId}
        contextLabel={propertyContextLabel}
        onClose={() => setEmailPanelOpen(false)}
        onSent={() => {
          setCheckedIds(new Set());
          setEmailPanelOpen(false);
        }}
      />
    </div>
  );
}
