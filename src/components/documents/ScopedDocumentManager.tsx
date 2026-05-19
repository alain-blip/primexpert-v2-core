import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, FileText, Folder, FolderPlus, Loader2, UploadCloud, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useLanguage } from '../../lib/i18n';
import {
  BROKER_TOOL_FOLDERS,
  CONTACT_DOCUMENT_TYPES,
} from '../../lib/propertyDocumentTaxonomy';
import {
  createDriveFolder,
  getDriveDocumentUrl,
  listDriveDocuments,
  uploadDriveDocument,
  type DriveDocument,
  type DriveDocumentScope,
} from '../../services/driveStorage';
import { DocumentDistributionBar } from '../residence/documents/DocumentDistributionPanel';
import { DocumentEmailPanel } from '../residence/documents/DocumentEmailPanel';
import {
  buildStorageQuotaLabel,
  bytesUsedByDriveDocuments,
  nextStorageTier,
  resolveStorageTier,
  STORAGE_TIER_LABELS,
  STORAGE_TIER_LIMITS_BYTES,
  wouldExceedStorageQuota,
} from '../../lib/quotaStorageService';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(ms: number, locale: 'fr' | 'en'): string {
  return new Date(ms || Date.now()).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export interface ScopedDocumentManagerProps {
  scope: DriveDocumentScope;
  title: string;
  subtitle?: string;
  contactId?: string;
  compact?: boolean;
}

export function ScopedDocumentManager({
  scope,
  title,
  subtitle,
  contactId,
  compact = false,
}: ScopedDocumentManagerProps) {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const brokerId = profile?.uid ?? '';
  const storageTier = resolveStorageTier(profile?.tier);
  const inputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<DriveDocument[]>([]);
  const [quotaDocs, setQuotaDocs] = useState<DriveDocument[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [folderPromptOpen, setFolderPromptOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [documentLabel, setDocumentLabel] = useState<string>(
    scope === 'contact' ? CONTACT_DOCUMENT_TYPES[0] : BROKER_TOOL_FOLDERS[0]
  );
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!brokerId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listDriveDocuments(
        { tenantId: brokerId, mode: 'strict' },
        scope === 'contact' ? { scope, contactId } : { scope }
      );
      const allRows = await listDriveDocuments({ tenantId: brokerId, mode: 'strict' });
      setDocs([...rows]);
      setQuotaDocs(allRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [brokerId, contactId, scope]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const currentFolder = useMemo(
    () => docs.find((d) => d.id === currentFolderId && d.type === 'folder') ?? null,
    [currentFolderId, docs]
  );

  const visibleDocs = useMemo(
    () =>
      docs
        .filter((d) => (d.parentId ?? null) === currentFolderId)
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.fileName.localeCompare(b.fileName, 'fr', { sensitivity: 'base' });
        }),
    [currentFolderId, docs]
  );

  const usedBytes = useMemo(() => bytesUsedByDriveDocuments(quotaDocs), [quotaDocs]);
  const quotaLabel = buildStorageQuotaLabel(usedBytes, storageTier);
  const quotaPercent = Math.min(100, (usedBytes / STORAGE_TIER_LIMITS_BYTES[storageTier]) * 100);

  const collectDescendantFileIds = useCallback(
    (folderId: string): string[] => {
      const children = docs.filter((d) => d.parentId === folderId);
      const directFiles = children.filter((d) => d.type === 'file').map((d) => d.id);
      const nested = children
        .filter((d) => d.type === 'folder')
        .flatMap((d) => collectDescendantFileIds(d.id));
      return [...directFiles, ...nested];
    },
    [docs]
  );

  const selectedIds = useMemo(
    () => docs.filter((d) => d.type === 'file' && checkedIds.has(d.id)).map((d) => `${scope}:${d.id}`),
    [checkedIds, docs, scope]
  );

  const toggleItem = useCallback(
    (doc: DriveDocument) => {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        const ids = doc.type === 'folder' ? [doc.id, ...collectDescendantFileIds(doc.id)] : [doc.id];
        const shouldCheck = !next.has(doc.id);
        for (const id of ids) {
          if (shouldCheck) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [collectDescendantFileIds]
  );

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !brokerId) return;
    const incomingBytes = Array.from(files).reduce((sum, f) => sum + f.size, 0);
    if (wouldExceedStorageQuota(usedBytes, incomingBytes, storageTier)) {
      const nextTier = nextStorageTier(storageTier);
      setError(
        `⚠️ Limite de capacité atteinte pour votre forfait actuel (${STORAGE_TIER_LABELS[storageTier]}). Veuillez contacter l'administration pour passer au forfait supérieur${nextTier ? ` (${STORAGE_TIER_LABELS[nextTier]})` : ''}.`
      );
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadDriveDocument({
          file,
          scope,
          contactId,
          toolFolder: scope === 'broker_tools' ? documentLabel : undefined,
          parentId: currentFolderId ?? undefined,
          documentLabel,
          ctx: { tenantId: brokerId, mode: 'strict' },
        });
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!brokerId || !folderName.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await createDriveFolder({
        name: folderName,
        scope,
        contactId,
        toolFolder: scope === 'broker_tools' ? documentLabel : undefined,
        parentId: currentFolderId ?? undefined,
        ctx: { tenantId: brokerId, mode: 'strict' },
      });
      setFolderName('');
      setFolderPromptOpen(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: DriveDocument) => {
    const url = await getDriveDocumentUrl(doc.storagePath);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const options = scope === 'contact' ? CONTACT_DOCUMENT_TYPES : BROKER_TOOL_FOLDERS;

  return (
    <section className="rounded-2xl border border-white/10 bg-vault-bright shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">{title}</h3>
          {subtitle ? <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={documentLabel}
            onChange={(e) => setDocumentLabel(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-bold text-slate-200"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading || !brokerId}
            onClick={() => setFolderPromptOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-100 disabled:opacity-50"
          >
            <FolderPlus className="h-4 w-4" />
            + Nouveau dossier
          </button>
          <button
            type="button"
            disabled={uploading || !brokerId}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Téléverser
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-black text-slate-100">{quotaLabel}</p>
          <p className="text-[10px] font-semibold text-slate-400">
            {currentFolder ? `Dossier ouvert : ${currentFolder.fileName}` : 'Racine'}
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-white" style={{ width: `${quotaPercent}%` }} />
        </div>
        {currentFolder ? (
          <button
            type="button"
            onClick={() => setCurrentFolderId(currentFolder.parentId ?? null)}
            className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-200 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour au dossier parent
          </button>
        ) : null}
      </div>

      {error ? <p className="mx-5 mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">{error}</p> : null}

      {folderPromptOpen ? (
        <div className="mx-5 mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-100">
              Nouveau dossier
            </p>
            <button type="button" onClick={() => setFolderPromptOpen(false)} className="text-slate-400">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Nom du dossier"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white px-3 py-2 text-[12px] font-semibold text-[#000000]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateFolder();
              }}
            />
            <button
              type="button"
              onClick={() => void handleCreateFolder()}
              className="rounded-xl bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#000000]"
            >
              Créer
            </button>
          </div>
        </div>
      ) : null}

      <div className={compact ? 'max-h-[300px] overflow-y-auto' : ''}>
        {loading ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : visibleDocs.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12px] text-slate-400">
            Aucun document dans ce dossier.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {visibleDocs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-blue-500/10">
                <input
                  type="checkbox"
                  checked={checkedIds.has(doc.id)}
                  onChange={() => toggleItem(doc)}
                  className="h-4 w-4 rounded border-slate-400"
                />
                {doc.type === 'folder' ? (
                  <Folder className="h-4 w-4 shrink-0 text-amber-300" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-blue-300" />
                )}
                <button
                  type="button"
                  onClick={() => doc.type === 'folder' && setCurrentFolderId(doc.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[12px] font-black text-slate-100">{doc.fileName}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {doc.type === 'folder'
                      ? 'Dossier — sélectionne tout son contenu'
                      : `${doc.documentLabel || doc.toolFolder || 'Document'} · ${formatDate(doc.uploadedAtMillis, locale)} · ${formatSize(doc.size)}`}
                  </p>
                </button>
                {doc.type === 'file' ? (
                  <button
                    type="button"
                    onClick={() => void handleDownload(doc)}
                    className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-blue-200"
                  >
                    <Download className="mr-1 inline h-3.5 w-3.5" />
                    Télécharger
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DocumentDistributionBar
        selectedCount={selectedIds.length}
        locale={locale}
        onOpenPanel={() => setEmailPanelOpen(true)}
      />
      <DocumentEmailPanel
        open={emailPanelOpen}
        locale={locale}
        documentIds={selectedIds}
        contactId={scope === 'contact' ? contactId : undefined}
        contextLabel={title}
        onClose={() => setEmailPanelOpen(false)}
        onSent={() => {
          setCheckedIds(new Set());
          setEmailPanelOpen(false);
        }}
      />
    </section>
  );
}
