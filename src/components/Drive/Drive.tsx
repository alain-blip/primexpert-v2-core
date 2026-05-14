/**
 * Drive.tsx — Drive PrimeXpert (Phase B — upload réel)
 *
 * Brief « SYSTÈME SILOS 2026 v4 » §4 — Innovation majeure :
 *   Gestionnaire de Documents style Google Drive, multi-tenant via brokerId.
 *
 * Phase B (actuelle) :
 *   ✅ Upload Firebase Storage (path : primexpert/{brokerId}/...)
 *   ✅ Liste des documents Firestore (filtrée multi-tenant)
 *   ❌ Extraction IA (Phase C — réutilisation `functions-ai` V1)
 *   ❌ Recherche full-text (Phase D)
 *
 * Multi-tenant garanti par @primexpert/core/tenant (stampTenant + tenantConstraints).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import {
  FolderOpen,
  UploadCloud,
  Sparkles,
  ShieldCheck,
  FileText,
  Loader2,
  Download,
  Home,
} from 'lucide-react';
import {
  listDriveDocuments,
  uploadDriveDocument,
  getDriveDocumentUrl,
  type DriveDocument,
} from '../../services/driveStorage';
import { extractDriveDocument } from '../../services/driveExtraction';
import { listResidences, type Residence } from '../../services/residences';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(ms: number, locale: string): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function Drive() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const brokerId = profile?.uid ?? '';

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<DriveDocument[]>([]);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [enableAiExtraction, setEnableAiExtraction] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!brokerId) return;
    setLoading(true);
    try {
      const [docs, res] = await Promise.all([
        listDriveDocuments({ tenantId: brokerId, mode: 'strict' }),
        listResidences({ tenantId: brokerId, mode: 'strict' }),
      ]);
      setDocuments(docs.sort((a, b) => b.uploadedAtMillis - a.uploadedAtMillis));
      setResidences(res);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [brokerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !brokerId) return;

    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadDriveDocument({
        file,
        residenceId: selectedResidenceId || undefined,
        ctx: { tenantId: brokerId, mode: 'strict' },
      });

      // Lance l'extraction IA en arrière-plan si activée et type adapté
      const aiEligibleMime = /^(application\/pdf|image\/)/i.test(uploaded.mime);
      if (enableAiExtraction && aiEligibleMime) {
        setExtracting(true);
        try {
          await extractDriveDocument({
            driveDocumentId: uploaded.id,
            storagePath: uploaded.storagePath,
            mime: uploaded.mime,
          });
        } catch (e) {
          console.warn('[Drive] Extraction IA échouée — document conservé sans enrichissement.', e);
        } finally {
          setExtracting(false);
        }
      }

      await reload();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (doc: DriveDocument) => {
    try {
      const url = await getDriveDocumentUrl(doc.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-blue-200/70">
            {t('Phase B — Drive multi-tenant', 'Phase B — Multi-tenant Drive')}
          </p>
          <h1 className="mt-2 text-5xl font-black italic tracking-tighter uppercase text-white">
            {t('Drive PrimeXpert', 'PrimeXpert Drive')}
            <span className="text-blue-400 opacity-30">.2026</span>
          </h1>
          <p className="mt-3 text-[12px] font-semibold text-slate-500 max-w-2xl">
            {t(
              "Stockage cloisonné par courtier. Upload réel, extraction IA en Phase C.",
              'Broker-scoped storage. Live uploads, AI extraction coming in Phase C.'
            )}
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading || !brokerId}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !brokerId}
            className="flex items-center gap-3 rounded-2xl bg-[#172554] px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_18px_38px_rgba(23, 37, 84,0.25)] hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? t('Téléversement…', 'Uploading…') : t('Téléverser un document', 'Upload a document')}
          </button>
        </div>
      </div>

      {/* Tenant pill */}
      <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-blue-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">
          {t('Espace cloisonné', 'Scoped workspace')} · brokerId ={' '}
          <span className="font-mono normal-case tracking-normal">{brokerId || '<non chargé>'}</span>
          {' · '}
          {documents.length} {t('document(s)', 'document(s)')}
        </p>
      </div>

      {/* Contexte upload — sélecteur résidence + extraction IA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-vault px-5 py-4">
        <label className="flex items-center gap-3">
          <Home className="h-4 w-4 text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
              {t('Rattacher à une résidence (optionnel)', 'Attach to a residence (optional)')}
            </span>
            <select
              value={selectedResidenceId}
              onChange={(e) => setSelectedResidenceId(e.target.value)}
              disabled={uploading || extracting}
              className="mt-1.5 w-full text-[11px] font-bold bg-transparent border-b border-white/10 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="">— {t('Aucune (dossier général)', 'None (general folder)')} —</option>
              {residences.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.address} · {r.city}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enableAiExtraction}
            onChange={(e) => setEnableAiExtraction(e.target.checked)}
            disabled={uploading || extracting}
            className="h-4 w-4 accent-blue-600"
          />
          <div className="flex-1">
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-300">
              <Sparkles className="inline h-3 w-3 mr-1" />
              {t("Extraction IA automatique après upload", 'Automatic AI extraction after upload')}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1">
              {t(
                'Lit le document et extrait les champs canoniques (prixAnnonce, TGA, NOI, etc.) via Gemini.',
                'Reads the document and extracts canonical fields (prixAnnonce, cap rate, NOI, etc.) via Gemini.'
              )}
            </span>
          </div>
        </label>
      </div>

      {extracting && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-400/30 bg-purple-500/[0.08] px-4 py-3 text-[11px] font-semibold text-purple-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('Extraction IA en cours — Gemini lit le document…', 'AI extraction in progress — Gemini is reading the document…')}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/[0.08] px-4 py-3 text-[11px] font-semibold text-red-300">
          {error}
        </div>
      )}

      {/* Document list */}
      <div className="rounded-[32px] border border-white/10 bg-vault-bright shadow-[0_24px_70px_rgba(15,23,42,0.08)] overflow-hidden">
        <div className="flex items-center justify-between px-7 py-5 border-b border-white/10">
          <h2 className="text-base font-black italic tracking-tight uppercase text-white">
            {t('Documents récents', 'Recent documents')}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
            {loading ? t('chargement…', 'loading…') : `${documents.length} ${t('docs', 'docs')}`}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="px-7 py-16 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
              {t('Aucun document pour ce courtier', 'No document for this broker yet')}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              {t('Téléverse ton premier document pour commencer.', 'Upload your first document to get started.')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {documents.map((doc) => {
              const residence = doc.residenceId ? residences.find((r) => r.id === doc.residenceId) : null;
              return (
              <li key={doc.id} className="flex items-center gap-5 px-7 py-4 hover:bg-blue-500/10 transition">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black italic tracking-tight text-slate-100 truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mt-0.5">
                    {formatDate(doc.uploadedAtMillis, language)} · {formatSize(doc.size)} · {doc.mime}
                  </p>
                  {residence && (
                    <p className="text-[10px] font-bold text-blue-300 mt-1 truncate">
                      <Home className="inline h-3 w-3 mr-1" />
                      {residence.address} · {residence.city}
                    </p>
                  )}
                  {doc.status === 'processing' && (
                    <p className="text-[10px] font-mono uppercase tracking-widest text-purple-300 mt-1">
                      <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                      {t('extraction IA…', 'AI extracting…')}
                    </p>
                  )}
                  {doc.status === 'failed' && (
                    <p className="text-[10px] font-mono uppercase tracking-widest text-red-300 mt-1">
                      {t('extraction IA échouée', 'AI extraction failed')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(doc)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-vault px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-blue-400 hover:text-blue-300 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('Télécharger', 'Download')}
                </button>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Statut Phase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          {
            icon: FolderOpen,
            title: t('Stockage cloisonné', 'Scoped storage'),
            desc: t(
              "Chaque fichier est rangé sous primexpert/{brokerId}/ — aucune fuite cross-tenant.",
              'Each file lives under primexpert/{brokerId}/ — no cross-tenant leakage.'
            ),
          },
          {
            icon: Sparkles,
            title: t('Extraction IA (Phase C)', 'AI extraction (Phase C)'),
            desc: t(
              "Branchement futur sur functions-ai (Copilote-RPA V1) pour lecture + champs canoniques.",
              'Upcoming hook into functions-ai (Copilote-RPA V1) for parsing + canonical fields.'
            ),
          },
          {
            icon: ShieldCheck,
            title: t('OACIQ — Coffre immuable', 'OACIQ — Immutable vault'),
            desc: t(
              "Conservation 6 ans, journal d'audit, validation humaine avant diffusion (Phase D).",
              '6-year retention, audit log, human validation before publication (Phase D).'
            ),
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-[32px] border border-white/10 bg-vault-bright p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-base font-black italic tracking-tight uppercase text-white">
                {card.title}
              </h2>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-500">{card.desc}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
