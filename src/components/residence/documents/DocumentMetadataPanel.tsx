import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, Shield, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { canDownloadPropertyDocument } from '../../../lib/propertyDocumentValidation';
import type { PropertyDocumentRecord } from '../../../types/propertyDocument';
import type { AssetNiche } from '../../../types/residence';
import type { MarketSiloType } from '../../../types/marketAnalytics';
import {
  MARKET_SILO_OPTIONS,
  assetNicheToDefaultSilo,
  flattenExtractedAmounts,
  formatExtractedCurrency,
  resolveRegionAdministrative,
} from '../../../lib/extractedDataInjection';
import { injectExtractedDataToResidence } from '../../../services/extractedDataInjectionService';
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
  tone: 'amber' | 'emerald' | 'red' | 'slate' | 'blue' | 'gold';
  children: React.ReactNode;
}) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    gold: 'border-[#D4AF37]/40 bg-amber-50 text-[#000000]',
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
    case 'verified':
      return (
        <StatusBadge tone="gold">
          {locale === 'fr' ? '✓ Montants validés par le courtier' : '✓ Amounts validated by broker'}
        </StatusBadge>
      );
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
  propertyId: string;
  brokerId: string;
  residenceCity?: string;
  residenceRegionHint?: string;
  assetNiche?: AssetNiche;
  locale: 'fr' | 'en';
  busy: boolean;
  onDownload: (doc: PropertyDocumentRecord) => Promise<void>;
  onDelete: (doc: PropertyDocumentRecord) => Promise<void>;
  onInjectionComplete?: () => void;
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
  propertyId,
  brokerId,
  residenceCity,
  residenceRegionHint,
  assetNiche,
  locale,
  busy,
  onDownload,
  onDelete,
  onInjectionComplete,
  labels,
}: DocumentMetadataPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [injectError, setInjectError] = useState<string | null>(null);
  const [siloType, setSiloType] = useState<MarketSiloType>(assetNicheToDefaultSilo(assetNiche));
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const downloadAllowed = useMemo(
    () => (document ? canDownloadPropertyDocument(document.virusScanStatus) : false),
    [document]
  );

  const amountRows = useMemo(
    () => (document?.extractedData ? flattenExtractedAmounts(document.extractedData) : []),
    [document?.extractedData]
  );

  const regionInfo = useMemo(
    () => resolveRegionAdministrative(residenceCity, residenceRegionHint),
    [residenceCity, residenceRegionHint]
  );

  const siloLabel = useMemo(() => {
    const opt = MARKET_SILO_OPTIONS.find((o) => o.id === siloType);
    return locale === 'fr' ? opt?.labelFr ?? siloType : opt?.labelEn ?? siloType;
  }, [siloType, locale]);

  useEffect(() => {
    setSiloType(assetNicheToDefaultSilo(assetNiche));
  }, [assetNiche, document?.id]);

  useEffect(() => {
    setCheckedIds(new Set(amountRows.map((r) => r.id)));
    setInjectError(null);
  }, [document?.id, amountRows]);

  const toggleRow = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const showVerification =
    document &&
    document.parsingEligible &&
    (document.parsingStatus === 'completed' || document.parsingStatus === 'verified') &&
    amountRows.length > 0;

  const isVerified = document?.parsingStatus === 'verified' || document?.isValidated === true;

  const handleInject = async () => {
    if (!document || !propertyId || !brokerId) return;
    const selected = amountRows.filter((r) => checkedIds.has(r.id));
    if (!selected.length) {
      setInjectError(
        locale === 'fr' ? 'Sélectionnez au moins un montant.' : 'Select at least one amount.'
      );
      return;
    }
    setInjecting(true);
    setInjectError(null);
    try {
      await injectExtractedDataToResidence({
        propertyId,
        document,
        selectedRows: selected,
        siloType,
        brokerId,
        residenceCity,
        residenceRegionHint,
      });
      onInjectionComplete?.();
    } catch (e) {
      setInjectError(e instanceof Error ? e.message : String(e));
    } finally {
      setInjecting(false);
    }
  };

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className={inst.sectionHeader}>
        <h3 className={inst.sectionTitle}>{labels.title}</h3>
      </header>

      {!document ? (
        <motionEmpty labels={labels} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <motionBadges labels={labels} document={document} locale={locale} />
          <motionAlerts document={document} labels={labels} />
          <motionScroll>
            <dl className="space-y-4 px-5 py-4">
              <MetaField label={labels.name} value={document.fileName} bold />
              <MetaField label={labels.size} value={formatSize(document.sizeBytes)} mono />
              <MetaField label={labels.date} value={formatDate(document.uploadedAtMillis, locale)} />
              <MetaField label={labels.type} value={document.mimeType} small />

              {showVerification ? (
                <ExtractionVerificationSection
                  locale={locale}
                  isVerified={isVerified}
                  amountRows={amountRows}
                  checkedIds={checkedIds}
                  toggleRow={toggleRow}
                  siloType={siloType}
                  setSiloType={setSiloType}
                  regionDisplayName={regionInfo.displayName}
                  siloLabel={siloLabel}
                  injectError={injectError}
                  injecting={injecting}
                  busy={busy}
                  onInject={() => void handleInject()}
                />
              ) : null}
            </dl>
          </motionScroll>
          <motionActions
            labels={labels}
            locale={locale}
            document={document}
            downloadAllowed={downloadAllowed}
            busy={busy}
            confirming={confirming}
            setConfirming={setConfirming}
            onDownload={onDownload}
            onDelete={onDelete}
          />
        </div>
      )}
    </aside>
  );
}

function motionEmpty({ labels }: { labels: DocumentMetadataPanelProps['labels'] }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <FileText className="h-10 w-10 text-slate-300" />
      <p className="text-sm text-slate-500">{labels.empty}</p>
    </div>
  );
}

function motionBadges({
  labels,
  document,
  locale,
}: {
  labels: DocumentMetadataPanelProps['labels'];
  document: PropertyDocumentRecord;
  locale: 'fr' | 'en';
}) {
  return (
    <motionScroll>
      <div className="space-y-2 border-b border-slate-100 px-5 py-3">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
          {labels.security}
        </p>
        {securityBadge(document, locale)}
        <p className="mt-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
          {labels.analysis}
        </p>
        {parsingBadge(document, locale)}
      </div>
    </motionScroll>
  );
}

function motionAlerts({
  document,
  labels,
}: {
  document: PropertyDocumentRecord;
  labels: DocumentMetadataPanelProps['labels'];
}) {
  return (
    <>
      {document.virusScanStatus === 'pending' ? (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-[11px] text-amber-950">{labels.securityPendingNote}</p>
        </div>
      ) : null}
      {document.virusScanStatus === 'infected' ? (
        <motionScroll>
          <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-900">
            {labels.securityInfectedNote}
          </div>
        </motionScroll>
      ) : null}
    </>
  );
}

function motionScroll({ children }: { children: React.ReactNode }) {
  return <motionScrollInner>{children}</motionScrollInner>;
}

function motionScrollInner({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto">{children}</motionScrollInner>;
}

function MetaField({
  label,
  value,
  bold,
  mono,
  small,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <dt className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</dt>
      <dd
        className={cn(
          'mt-1 break-words text-[12px] text-slate-800',
          bold && 'font-semibold text-[#000000]',
          mono && 'font-mono',
          small && 'break-all text-[11px] text-slate-600'
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ExtractionVerificationSection({
  locale,
  isVerified,
  amountRows,
  checkedIds,
  toggleRow,
  siloType,
  setSiloType,
  regionDisplayName,
  siloLabel,
  injectError,
  injecting,
  busy,
  onInject,
}: {
  locale: 'fr' | 'en';
  isVerified: boolean;
  amountRows: ReturnType<typeof flattenExtractedAmounts>;
  checkedIds: Set<string>;
  toggleRow: (id: string) => void;
  siloType: MarketSiloType;
  setSiloType: (v: MarketSiloType) => void;
  regionDisplayName: string;
  siloLabel: string;
  injectError: string | null;
  injecting: boolean;
  busy: boolean;
  onInject: () => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">
        {locale === 'fr' ? 'Détails de l’extraction IA' : 'AI extraction details'}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-800">
        {locale === 'fr' ? 'Vérification des montants' : 'Amount verification'}
      </p>

      {isVerified ? (
        <p className="mt-2 text-[11px] text-emerald-900">
          {locale === 'fr'
            ? 'Montants injectés dans la fiche et transmis au Big Data anonymisé.'
            : 'Amounts injected into the listing and sent to anonymized market data.'}
        </p>
      ) : (
        <>
          <label className="mt-3 block">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
              {locale === 'fr' ? 'Catégorie (silo)' : 'Category (silo)'}
            </span>
            <select
              value={siloType}
              onChange={(e) => setSiloType(e.target.value as MarketSiloType)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-[#000000]"
            >
              {MARKET_SILO_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {locale === 'fr' ? opt.labelFr : opt.labelEn}
                </option>
              ))}
            </select>
          </label>

          <ul className="mt-3 max-h-[200px] space-y-2 overflow-y-auto pr-1">
            {amountRows.map((row) => (
              <li
                key={row.id}
                className="flex items-start gap-2 rounded-lg border border-white bg-white px-2 py-2 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(row.id)}
                  onChange={() => toggleRow(row.id)}
                  className="mt-1 h-3.5 w-3.5 shrink-0 accent-[#D4AF37]"
                  aria-label={row.label}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium leading-snug text-slate-700">{row.label}</p>
                  <p className="font-mono text-[12px] font-black text-[#000000]">
                    {formatExtractedCurrency(row.value, locale)}
                  </p>
                </motionScroll>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[10px] leading-snug text-slate-600">
            🔒{' '}
            {locale === 'fr'
              ? `En injectant, ces données anonymisées alimenteront les statistiques de marché de la région ${regionDisplayName} pour la catégorie ${siloLabel}.`
              : `By injecting, these anonymized data will feed market statistics for ${regionDisplayName} (${siloLabel}).`}
          </p>

          {injectError ? (
            <p className="mt-2 text-[10px] font-semibold text-red-800" role="alert">
              {injectError}
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy || injecting || checkedIds.size === 0}
            onClick={onInject}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/60',
              'bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#000000]',
              'hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {injecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {locale === 'fr' ? 'Injecter et alimenter le Big Data' : 'Inject and feed market data'}
          </button>
        </>
      )}
    </section>
  );
}

function motionActions({
  labels,
  locale,
  document,
  downloadAllowed,
  busy,
  confirming,
  setConfirming,
  onDownload,
  onDelete,
}: {
  labels: DocumentMetadataPanelProps['labels'];
  locale: 'fr' | 'en';
  document: PropertyDocumentRecord;
  downloadAllowed: boolean;
  busy: boolean;
  confirming: boolean;
  setConfirming: (v: boolean) => void;
  onDownload: (doc: PropertyDocumentRecord) => Promise<void>;
  onDelete: (doc: PropertyDocumentRecord) => Promise<void>;
}) {
  return (
    <div className="mt-auto shrink-0 space-y-2 border-t border-slate-200 p-4">
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
  );
}
