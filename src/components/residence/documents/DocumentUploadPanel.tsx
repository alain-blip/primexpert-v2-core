import React, { useCallback, useRef, useState } from 'react';
import { AlertTriangle, FileText, Loader2, Upload } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  validatePropertyDocumentFile,
  validationErrorMessage,
} from '../../../lib/propertyDocumentValidation';
import {
  ACHEUTEURS_SUBSECTIONS,
  resolveAcheteursSubsection,
  type AcheteursSubsection,
  type TransactionDocumentTab,
} from '../../../lib/propertyDocumentTaxonomy';
import type { PropertyDocumentRecord } from '../../../types/propertyDocument';
import { inst } from '../institutional/InstitutionalUi';

const ACCEPT_ATTR = ALLOWED_DOCUMENT_MIME_TYPES.join(',');

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(ms: number, locale: 'fr' | 'en'): string {
  return new Date(ms).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export interface DocumentUploadPanelProps {
  documents: PropertyDocumentRecord[];
  selectedId: string | null;
  checkedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  onToggleCheckAll: (ids: string[], checked: boolean) => void;
  activeTab: TransactionDocumentTab;
  loading: boolean;
  uploading: boolean;
  uploadDisabled?: boolean;
  onSelect: (doc: PropertyDocumentRecord) => void;
  onUpload: (files: File[]) => Promise<void>;
  locale: 'fr' | 'en';
  labels: {
    dropTitle: string;
    dropHint: string;
    browse: string;
    uploadedTitle: string;
    empty: string;
    loading: string;
  };
}

function DocumentRow({
  doc,
  active,
  checked,
  locale,
  onSelect,
  onToggleCheck,
}: {
  doc: PropertyDocumentRecord;
  active: boolean;
  checked: boolean;
  locale: 'fr' | 'en';
  onSelect: () => void;
  onToggleCheck: () => void;
}) {
  const scanPending = doc.virusScanStatus === 'pending';

  return (
    <li className="border-b border-slate-100">
      <div
        className={cn(
          'flex w-full items-start gap-2 px-3 py-3 transition',
          active ? 'bg-amber-50' : 'hover:bg-slate-50'
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleCheck();
          }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
          aria-label={locale === 'fr' ? `Sélectionner ${doc.fileName}` : `Select ${doc.fileName}`}
        />
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-[#142c6a]">{doc.fileName}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {formatSize(doc.sizeBytes)} · {formatDate(doc.uploadedAtMillis, locale)}
            </p>
            {scanPending ? (
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                {locale === 'fr' ? 'Vérification en cours' : 'Scan in progress'}
              </p>
            ) : null}
          </div>
        </button>
      </div>
    </li>
  );
}

function groupAcheteursDocs(docs: PropertyDocumentRecord[]) {
  const groups = new Map<AcheteursSubsection | 'autre', PropertyDocumentRecord[]>();
  for (const doc of docs) {
    const key = resolveAcheteursSubsection(doc.extractedData, doc.fileName);
    const list = groups.get(key) ?? [];
    list.push(doc);
    groups.set(key, list);
  }
  const ordered: Array<{ key: AcheteursSubsection | 'autre'; docs: PropertyDocumentRecord[] }> = [];
  for (const sub of ACHEUTEURS_SUBSECTIONS) {
    const list = groups.get(sub.id);
    if (list?.length) ordered.push({ key: sub.id, docs: list });
  }
  const autre = groups.get('autre');
  if (autre?.length) ordered.push({ key: 'autre', docs: autre });
  return ordered;
}

export function DocumentUploadPanel({
  documents,
  selectedId,
  checkedIds,
  onToggleCheck,
  onToggleCheckAll,
  activeTab,
  loading,
  uploading,
  uploadDisabled = false,
  onSelect,
  onUpload,
  locale,
  labels,
}: DocumentUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);

  const allIds = documents.map((d) => d.id);
  const allChecked = allIds.length > 0 && allIds.every((id) => checkedIds.has(id));

  const filterAndUpload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;

      const accepted: File[] = [];
      const errors: string[] = [];

      for (const file of list) {
        const result = validatePropertyDocumentFile(file);
        if (result.ok) {
          accepted.push(file);
        } else {
          errors.push(`${file.name}: ${validationErrorMessage(result.code, locale)}`);
        }
      }

      if (errors.length) {
        setRejectMessage(errors.join(' '));
      } else {
        setRejectMessage(null);
      }

      if (!accepted.length) return;

      await onUpload(accepted);
    },
    [locale, onUpload]
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (uploading || uploadDisabled) return;
      await filterAndUpload(e.dataTransfer.files);
    },
    [filterAndUpload, uploading, uploadDisabled]
  );

  const renderList = () => {
    if (activeTab !== 'acheteurs') {
      return (
        <ul>
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              active={selectedId === doc.id}
              checked={checkedIds.has(doc.id)}
              locale={locale}
              onSelect={() => onSelect(doc)}
              onToggleCheck={() => onToggleCheck(doc.id)}
            />
          ))}
        </ul>
      );
    }

    const groups = groupAcheteursDocs(documents);
    return (
      <div className="space-y-4 pb-2">
        {groups.map(({ key, docs: sectionDocs }) => {
          const subDef = ACHEUTEURS_SUBSECTIONS.find((s) => s.id === key);
          const title =
            key === 'autre'
              ? locale === 'fr'
                ? 'Autres documents'
                : 'Other documents'
              : locale === 'fr'
                ? subDef?.labelFr
                : subDef?.labelEn;
          return (
            <section key={key}>
              <p className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                {title}
              </p>
              <ul>
                {sectionDocs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    active={selectedId === doc.id}
                    checked={checkedIds.has(doc.id)}
                    locale={locale}
                    onSelect={() => onSelect(doc)}
                    onToggleCheck={() => onToggleCheck(doc.id)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <section className="relative flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'm-4 rounded-xl border-2 border-dashed bg-white p-6 text-center shadow-sm transition',
          dragOver ? 'border-[#D4AF37] bg-amber-50/50' : 'border-slate-200 hover:border-slate-300'
        )}
      >
        <Upload className="mx-auto h-7 w-7 text-slate-400" />
        <p className="mt-2 text-sm font-black text-[#142c6a]">{labels.dropTitle}</p>
        <p className="mt-1 text-[11px] text-slate-600">{labels.dropHint}</p>
        <button
          type="button"
          disabled={uploading || uploadDisabled}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-[#D4AF37]/50 hover:bg-amber-50 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {labels.browse}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void filterAndUpload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {rejectMessage ? (
        <div
          role="alert"
          className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{rejectMessage}</p>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col border-t border-slate-200">
        <header className={cn(inst.sectionHeader, 'flex items-center justify-between gap-2 pr-3')}>
          <h3 className={inst.sectionTitle}>{labels.uploadedTitle}</h3>
          {documents.length > 0 ? (
            <label className="flex cursor-pointer items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleCheckAll(allIds, e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              {locale === 'fr' ? 'Tout' : 'All'}
            </label>
          ) : null}
        </header>
        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">{labels.loading}</span>
            </div>
          ) : documents.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">{labels.empty}</p>
          ) : (
            renderList()
          )}
        </div>
      </div>
    </section>
  );
}
