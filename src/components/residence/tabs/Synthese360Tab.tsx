import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/auth';
import { useLanguage } from '../../../lib/i18n';
import { cn, formatCurrency } from '../../../lib/utils';
import type { Residence } from '../../../services/residences';

type ResidenceLoose = Residence & Record<string, unknown>;
type BusinessStatus = 'complet' | 'attention' | 'a_completer';

interface Synthese360TabProps {
  residence: Residence;
  residenceId: string;
}

interface BrokerNote {
  id: string;
  text: string;
  authorId?: string;
  authorName?: string;
  createdAt?: unknown;
}

function parseSafeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const parsed = parseFloat(value.trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickNumber(source: ResidenceLoose, keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    const parsed = parseSafeNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

function pickNestedNumber(source: ResidenceLoose, objectKey: string, keys: string[]): number {
  const nested = source[objectKey];
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return 0;
  return pickNumber(nested as Record<string, unknown> as ResidenceLoose, keys);
}

function pickText(source: ResidenceLoose, keys: string[], fallback = '—'): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed && trimmed !== '—') return trimmed;
  }
  return fallback;
}

function pickDate(source: ResidenceLoose, keys: string[]): Date | null {
  for (const key of keys) {
    const value = source[key];
    if (!value) continue;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      const parsed = value.toDate();
      if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateFr(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-CA', {
    dateStyle: 'medium',
    timeZone: 'America/Toronto',
  }).format(date);
}

function formatUnknownDate(value: unknown): string {
  if (!value) return '—';
  if (value instanceof Date) return formatDateFr(value);
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return formatDateFr(value.toDate());
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return formatDateFr(parsed);
  }
  return '—';
}

function formatPctDisplay(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 }).format(value)} %`;
}

function calculateBusinessStatus(residence: ResidenceLoose): BusinessStatus {
  const hasName = pickText(residence, ['residenceName', 'commercialName', 'nomCommercial', 'nom_commercial', 'name'], '') !== '';
  const hasPrice = pickNumber(residence, ['askingPrice', 'prixDemande', 'price', 'prixAnnonce']) > 0;
  const hasAddress = pickText(residence, ['address', 'adresse'], '') !== '';
  if (hasName && hasPrice && hasAddress) return 'complet';
  if (hasPrice || hasName) return 'attention';
  return 'a_completer';
}

function resolveRetribution(residence: ResidenceLoose): {
  commissionRate: number;
  potentialRevenue: number;
} {
  const commissionRate =
    pickNumber(residence, [
      'commissionRate',
      'tauxCommission',
      'commissionPct',
      'commission.totalePct',
      'commission.inscripteurPct',
    ]) ||
    pickNestedNumber(residence, 'commission', ['totalePct', 'inscripteurPct']);
  const prixDemande = pickNumber(residence, ['askingPrice', 'prixDemande', 'price', 'prixAnnonce']);
  const extractedRevenue = pickNumber(residence, [
    'potentialRevenue',
    'revenuPotentiel',
    'revenuPotentielCommission',
    'revenuPotentielAnnuel',
    'revenusPotentiels',
  ]);
  const potentialRevenue =
    commissionRate > 0 && prixDemande > 0
      ? prixDemande * (commissionRate / 100)
      : extractedRevenue;
  return { commissionRate, potentialRevenue };
}

function BusinessStatusBadge({ status }: { status: BusinessStatus }) {
  const config: Record<BusinessStatus, { label: string; cls: string }> = {
    complet: { label: 'Dossier structuré', cls: 'border-emerald-700 bg-emerald-50 text-emerald-900' },
    attention: { label: 'À valider', cls: 'border-amber-500 bg-amber-100 text-amber-950' },
    a_completer: { label: 'À compléter', cls: 'border-red-700 bg-red-50 text-red-900' },
  };
  return (
    <span className={cn('inline-flex w-fit rounded-lg border px-3 py-2 text-[12px] font-black uppercase tracking-wider', config[status].cls)}>
      {config[status].label}
    </span>
  );
}

function GuardrailBanner({ status }: { status: BusinessStatus }) {
  const ok = status === 'complet';
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border-2 px-4 py-3 shadow-lg', ok ? 'border-emerald-700 bg-emerald-50' : 'border-amber-500 bg-amber-50')}>
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-800" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />}
      <p className="text-[13px] font-bold leading-relaxed text-black">
        {ok
          ? 'Dossier prêt pour la présentation exécutive.'
          : 'Validation requise avant présentation : nom commercial, prix demandé ou adresse à confirmer.'}
      </p>
    </div>
  );
}

function FinancialSafetyBlock({ commissionRate, potentialRevenue }: { commissionRate: number; potentialRevenue: number }) {
  return (
    <div className="my-4 flex w-full flex-col gap-2 rounded-xl border-2 border-[#142c6a] bg-[#f1f5f9] p-4 text-[15px] font-black text-[#142c6a] sm:flex-row sm:items-center sm:justify-between">
      <span>TAUX DE COMMISSION COMPLET : {formatPctDisplay(commissionRate)}</span>
      <span>REVENU POTENTIEL ATTENDU : {potentialRevenue > 0 ? formatCurrency(potentialRevenue) : '—'}</span>
    </div>
  );
}

function MirrorBadgeAI({ residence }: { residence: ResidenceLoose }) {
  const insight =
    pickText(residence, ['summaryOneLine', 'resumeExecutif', 'marketSummary'], '') ||
    pickText((residence.aiInsights as ResidenceLoose | undefined) ?? ({} as ResidenceLoose), ['summary', 'resume'], '');
  return (
    <div className="flex flex-col rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-lg">
      <span className="w-fit rounded border border-amber-400 bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-amber-950">
        SUGGESTION IA
      </span>
      <p className="mt-2 text-[14px] font-semibold leading-relaxed text-slate-800">
        {insight || 'Consolider les signaux financiers, le marché local et les preuves de conformité avant présentation.'}
      </p>
    </div>
  );
}

function PaperSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border-2 border-[#142c6a] bg-white shadow-xl', className)}>
      <header className="border-b-2 border-[#142c6a]/15 bg-[#f1f5f9] px-5 py-3">
        <h3 className="text-[12px] font-black uppercase tracking-wider text-[#142c6a]">{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Synthese360Tab({ residence, residenceId }: Synthese360TabProps) {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const loose = residence as ResidenceLoose;
  const businessStatus = useMemo(() => calculateBusinessStatus(loose), [loose]);
  const retribution = useMemo(() => resolveRetribution(loose), [loose]);
  const [notes, setNotes] = useState<BrokerNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [notesPage, setNotesPage] = useState(1);
  const notesPerPage = 5;

  const residenceName = pickText(loose, ['residenceName', 'commercialName', 'nomCommercial', 'nom_commercial', 'name'], 'RPA À NOMMER');
  const askingPrice = pickNumber(loose, ['askingPrice', 'prixDemande', 'price', 'prixAnnonce']);
  const address = [pickText(loose, ['address', 'adresse'], ''), pickText(loose, ['city', 'ville'], '')]
    .filter(Boolean)
    .join(', ');
  const acceptedDate = pickDate(loose, ['datePromesseAcceptee', 'acceptedOfferAt', 'promiseAcceptedAt', 'date']);
  const j3 = acceptedDate ? addDays(acceptedDate, 3) : null;
  const j180 = acceptedDate ? addDays(acceptedDate, 180) : null;

  useEffect(() => {
    if (!residenceId) return undefined;
    const notesQuery = query(collection(db, 'residences', residenceId, 'notes'), orderBy('createdAt', 'desc'));
    return onSnapshot(notesQuery, (snapshot) => {
      setNotes(
        snapshot.docs.map((noteDoc) => {
          const data = noteDoc.data();
          return {
            id: noteDoc.id,
            text: typeof data.text === 'string' ? data.text : String(data.texte ?? ''),
            authorId: typeof data.authorId === 'string' ? data.authorId : undefined,
            authorName: typeof data.authorName === 'string' ? data.authorName : undefined,
            createdAt: data.createdAt,
          };
        })
      );
    });
  }, [residenceId]);

  const addNote = useCallback(async () => {
    if (!newNote.trim() || !user || !residenceId) return;
    await addDoc(collection(db, 'residences', residenceId, 'notes'), {
      text: newNote.trim(),
      authorId: user.uid,
      authorName: profile?.displayName || user.displayName || user.email || 'Courtier',
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'residences', residenceId), {
      lastCommunicationAt: serverTimestamp(),
      lastCommunicationType: 'note',
      updatedAt: serverTimestamp(),
    });
    setNewNote('');
  }, [newNote, profile?.displayName, residenceId, user]);

  const deleteNote = useCallback(async (noteId: string) => {
    if (!residenceId) return;
    await deleteDoc(doc(db, 'residences', residenceId, 'notes', noteId));
  }, [residenceId]);

  const safePage = Math.max(1, parseInt(String(notesPage), 10) || 1);
  const visibleNotes = notes.slice((safePage - 1) * notesPerPage, safePage * notesPerPage);
  const pageCount = Math.max(1, Math.ceil(notes.length / notesPerPage));

  return (
    <div className="space-y-5 rounded-2xl border-2 border-[#142c6a] bg-white p-4 text-slate-900 shadow-2xl">
      <div className="space-y-3">
        <GuardrailBanner status={businessStatus} />
        <BusinessStatusBadge status={businessStatus} />
      </div>

      <PaperSection title={t('Bilan exécutif 360°', '360° executive summary')}>
        <div>
          <div>
            <p className="block truncate text-[18px] font-black uppercase tracking-wide text-[#142c6a]">{residenceName}</p>
            <p className="mt-1 block text-[24px] font-black text-black">{formatCurrency(askingPrice)}</p>
            <p className="mt-1 block truncate text-[14px] font-medium text-slate-700">{address || 'Adresse à confirmer'}</p>
          </div>
          <FinancialSafetyBlock {...retribution} />
        </div>
      </PaperSection>

      <PaperSection title={t('Conformité transactionnelle — Loi C-73.2', 'Transaction compliance — C-73.2 Act')}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border-2 border-[#142c6a]/25 bg-white p-4">
            <p className="rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-[12px] font-black uppercase tracking-wider text-amber-950">
              J+3 — Droit de dédit
            </p>
            <p className="mt-3 text-[14px] font-black text-black">{formatDateFr(j3)}</p>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-700">
              Suivi de la fenêtre de résiliation discrétionnaire dans les 3 jours suivant la réception du double signé.
            </p>
          </div>
          <div className="rounded-xl border-2 border-[#142c6a]/25 bg-white p-4">
            <p className="rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-[12px] font-black uppercase tracking-wider text-amber-950">
              J+180 — Période de protection
            </p>
            <p className="mt-3 text-[14px] font-black text-black">{formatDateFr(j180)}</p>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-700">
              Traçabilité des acheteurs qualifiés ayant manifesté un intérêt pendant le mandat exclusif.
            </p>
          </div>
        </div>
      </PaperSection>

      <MirrorBadgeAI residence={loose} />

      <PaperSection title={t('Notes de diligence', 'Diligence notes')}>
        <div className="space-y-3">
          <textarea
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
            className="min-h-[90px] w-full rounded-xl border-2 border-[#142c6a]/25 bg-white p-3 text-[14px] font-semibold text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#142c6a]"
            placeholder={t('Ajouter une note de diligence...', 'Add a diligence note...')}
          />
          <button
            type="button"
            onClick={() => void addNote()}
            className="rounded-lg border-2 border-[#142c6a] bg-[#142c6a] px-4 py-2 text-[12px] font-black uppercase tracking-wider text-white"
          >
            {t('Ajouter la note', 'Add note')}
          </button>

          <ul className="space-y-2">
            {visibleNotes.map((note) => (
              <li key={note.id} className="rounded-xl border-2 border-[#142c6a]/15 bg-[#f1f5f9] p-3 text-[14px] text-slate-900">
                <p className="font-semibold leading-relaxed">{note.text}</p>
                <div className="mt-2 flex items-center justify-between gap-3 text-[12px] font-bold text-slate-600">
                  <span>{note.authorName || 'Courtier'} · {formatUnknownDate(note.createdAt)}</span>
                  {note.authorId === user?.uid ? (
                    <button type="button" onClick={() => void deleteNote(note.id)} className="text-red-800 underline">
                      {t('Supprimer', 'Delete')}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {notes.length > notesPerPage ? (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: pageCount }, (_, idx) => idx + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setNotesPage(parseInt(String(page), 10))}
                  className={cn(
                    'h-8 w-8 rounded border-2 text-[12px] font-black',
                    page === safePage ? 'border-[#142c6a] bg-[#142c6a] text-white' : 'border-slate-300 bg-white text-[#142c6a]'
                  )}
                >
                  {page}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </PaperSection>

      <div className="rounded-xl border-2 border-[#142c6a]/20 bg-white p-4 shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#142c6a]" />
          <p className="text-[12px] font-black uppercase tracking-wider text-[#142c6a]">
            {t('Connecteurs métier conservés', 'Business connectors preserved')}
          </p>
        </div>
        <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-700">
          {t(
            'Les sous-collections Firestore et le modèle multi-tenant demeurent inchangés. Les modules propriétaires, activités et tâches pourront être branchés ici dès que leurs composants V2 seront présents dans le dépôt.',
            'Firestore subcollections and the multi-tenant model remain unchanged. Owners, activities, and task modules can be connected here once their V2 components exist in the repository.'
          )}
        </p>
      </div>
    </div>
  );
}

export default Synthese360Tab;
