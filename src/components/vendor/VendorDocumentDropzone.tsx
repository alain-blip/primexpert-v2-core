import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, FileCheck, Loader2, Upload, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  subscribeAllPropertyDocuments,
  uploadPropertyDocument,
  type PropertyDocumentRecord,
} from '../../services/propertyDocumentsService';
import { notifyVendorPortalDocumentUpload } from '../../services/vendorPortalAccessService';
import {
  VENDOR_PORTAL_PARENT_CATEGORIES,
  isVendorPortalHorsListeEntry,
  vendorPortalEntriesForParent,
  type VendorPortalCatalogueEntry,
  type VendorPortalParentCategory,
} from '@primexpert/core/residence';
import type { PropertyDocumentCategory } from '../../types/propertyDocument';
import {
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
} from '../../lib/institutionalTheme';

function mapStorageCategory(cat: VendorPortalCatalogueEntry['storageCategory']): PropertyDocumentCategory {
  if (cat === 'legal') return 'legal';
  if (cat === 'technique') return 'technique';
  return 'financier';
}

function docMatchesEntry(doc: PropertyDocumentRecord, entry: VendorPortalCatalogueEntry): boolean {
  if (doc.vendorPortalTypeId === entry.id) return true;
  const label = doc.vendorPortalLabelFr ?? doc.extractedData?.documentType ?? doc.promesseDocLabel;
  if (typeof label === 'string' && label.trim() === entry.labelFr) return true;
  return false;
}

function CategoryAccordion({
  parentId,
  title,
  description,
  entries,
  docs,
  locale,
  t,
  onUpload,
  uploadingId,
}: {
  parentId: VendorPortalParentCategory;
  title: string;
  description: string;
  entries: VendorPortalCatalogueEntry[];
  docs: PropertyDocumentRecord[];
  locale: 'fr' | 'en';
  t: (fr: string, en: string) => string;
  onUpload: (entry: VendorPortalCatalogueEntry, file: File, customLabel?: string) => Promise<void>;
  uploadingId: string | null;
}) {
  const [open, setOpen] = useState(parentId === 'documents_a_partager');
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});

  return (
    <section className={cn(institutionalListingsCardShellClass, 'bg-white dark:bg-primexpert-cardDark')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 border-b-2 border-primexpert-dark/15 bg-primexpert-light px-5 py-4 text-left dark:bg-primexpert-cardDark"
      >
        <div>
          <p className={institutionalListingsCardTitleClass}>{title}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-900">{description}</p>
        </div>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-primexpert-dark transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="divide-y divide-primexpert-dark/10"
          >
            {entries.map((entry) => {
              const received = docs.filter((d) => docMatchesEntry(d, entry));
              const isHors = isVendorPortalHorsListeEntry(entry.id);
              const label = locale === 'fr' ? entry.labelFr : entry.labelEn;
              const inputId = `vendor-upload-${entry.id}`;
              const busy = uploadingId === entry.id;

              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-2 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-primexpert-cardDark"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-black">{label}</p>
                    {received.length > 0 ? (
                      <ul className="mt-1 space-y-0.5">
                        {received.slice(0, 3).map((d) => (
                          <li key={d.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-900">
                            <FileCheck className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
                            {d.fileName}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-primexpert-dark/70">
                        {t('Manquant', 'Missing')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    {isHors ? (
                      <input
                        type="text"
                        value={customLabels[entry.id] ?? ''}
                        onChange={(e) =>
                          setCustomLabels((prev) => ({ ...prev, [entry.id]: e.target.value }))
                        }
                        placeholder={t('Libellé du document', 'Document label')}
                        className="rounded-lg border-2 border-primexpert-dark/20 bg-white px-2 py-1 text-[12px] font-semibold text-black dark:bg-primexpert-cardDark"
                      />
                    ) : null}
                    {received.length > 0 ? (
                      <span className="inline-flex items-center justify-center rounded-md border-2 border-emerald-600 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-900 dark:bg-emerald-100">
                        {t('Reçu', 'Received')}
                      </span>
                    ) : null}
                    <label
                      htmlFor={inputId}
                      className={cn(
                        'inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg border-2 border-primexpert-dark bg-primexpert-dark px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primexpert-blue',
                        busy && 'pointer-events-none opacity-60'
                      )}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Upload className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {t('Déposer', 'Upload')}
                    </label>
                    <input
                      id={inputId}
                      type="file"
                      className="sr-only"
                      disabled={Boolean(busy)}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        const custom = isHors ? customLabels[entry.id]?.trim() : undefined;
                        if (isHors && !custom) return;
                        void onUpload(entry, file, custom);
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

export function VendorDocumentDropzone({
  propertyId,
  brokerId,
  orgId,
  contactId,
  contactName,
  inviteToken,
  uploadSource,
  t,
  locale,
  onDocumentsChange,
}: {
  propertyId: string;
  brokerId: string;
  orgId: string;
  contactId: string;
  contactName: string;
  inviteToken?: string;
  uploadSource: 'vendor_portal' | 'broker';
  t: (fr: string, en: string) => string;
  locale: 'fr' | 'en';
  onDocumentsChange?: (docs: PropertyDocumentRecord[]) => void;
}) {
  const [docs, setDocs] = useState<PropertyDocumentRecord[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onDocumentsChangeRef = useRef(onDocumentsChange);
  onDocumentsChangeRef.current = onDocumentsChange;

  useEffect(() => {
    if (!propertyId) {
      setDocs([]);
      return;
    }
    return subscribeAllPropertyDocuments(
      propertyId,
      (rows) => {
        setDocs(rows);
        onDocumentsChangeRef.current?.(rows);
      },
      () => setDocs([])
    );
  }, [propertyId]);

  const handleUpload = useCallback(
    async (entry: VendorPortalCatalogueEntry, file: File, customLabel?: string) => {
      if (!propertyId || !brokerId) return;
      const isHors = isVendorPortalHorsListeEntry(entry.id);
      const labelFr = isHors && customLabel ? customLabel.trim() : entry.labelFr;
      if (!labelFr) return;
      setUploadingId(entry.id);
      setError(null);
      try {
        const promesseScope = entry.parentCategory === 'promesse_achat';
        const record = await uploadPropertyDocument({
          propertyId,
          category: mapStorageCategory(entry.storageCategory),
          file,
          uploadedBy: brokerId,
          promesseScope,
          promesseDocLabel: promesseScope ? labelFr : undefined,
          vendorPortalTypeId: isHors ? undefined : entry.id,
          vendorPortalLabelFr: labelFr,
          uploadSource,
        });
        await notifyVendorPortalDocumentUpload({
          orgId,
          brokerId,
          residenceId: propertyId,
          documentId: record.id,
          documentLabel: labelFr,
          contactName,
          contactId,
          token: inviteToken,
        });
      } catch (e) {
        console.error('[VendorDocumentDropzone]', e);
        setError(
          e instanceof Error ? e.message : t('Téléversement impossible.', 'Upload failed.')
        );
      } finally {
        setUploadingId(null);
      }
    },
    [propertyId, brokerId, orgId, contactId, contactName, inviteToken, uploadSource, t]
  );

  const parents = useMemo(
    () =>
      VENDOR_PORTAL_PARENT_CATEGORIES.map((parent) => ({
        parent,
        entries: vendorPortalEntriesForParent(parent.id),
      })),
    []
  );

  return (
    <div className="space-y-4">
      {parents.map(({ parent, entries }) => (
        <CategoryAccordion
          key={parent.id}
          parentId={parent.id}
          title={locale === 'fr' ? parent.labelFr : parent.labelEn}
          description={locale === 'fr' ? parent.descriptionFr : parent.descriptionEn}
          entries={entries}
          docs={docs}
          locale={locale}
          t={t}
          onUpload={handleUpload}
          uploadingId={uploadingId}
        />
      ))}
      {error ? (
        <p className="flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-900 dark:bg-red-100">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
