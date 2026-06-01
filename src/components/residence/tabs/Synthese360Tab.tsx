import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type DocumentData } from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Check,
  Database,
} from 'lucide-react';
import {
  buildContactDisplayName,
  buildRaphaelResidenceSnapshot,
  rankRaphaelMatches,
  type OrganizationContact,
  type RaphaelMatchCandidate,
} from '@primexpert/core/crm';
import { listOrganizationContacts, type ContactServiceContext } from '../../../services/contacts';
import { stashContentGenPrefill } from '../../../lib/contentGenPrefill';
import { useWorkhubNav } from '../../../lib/workhubNav';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/auth';
import { useLanguage } from '../../../lib/i18n';
import { cn, formatCurrency } from '../../../lib/utils';
import { getListingPrice } from '@primexpert/core/residence';
import { readCalculatedResultsDisplayMirror, type CalculatedResultsDisplayMirror } from '@primexpert/core/financial';
import { bootstrapResidenceAcm } from '@primexpert/core/valuation';
import { useUnifiedResidence, useResidenceFinancialHints } from '../../../context/ResidenceDataContext';
import { useFinancialData } from '../../../context/FinancialDataContext';
import type { Residence } from '../../../services/residences';
import { buildCommissionFirestorePatch, buildListingPriceFirestorePatch } from '../../../services/residences';
import { fmtBuyerTgaPct } from '../../../services/buyerReportPdfService';
import type { PropertyDocumentExtractedData, PropertyDocumentRecord } from '../../../types/propertyDocument';
import { ResidenceActivitiesPanel } from '../activities/ResidenceActivitiesPanel';
import { ResidenceTasksPanel } from '../tasks/ResidenceTasksPanel';
import { AudioRecorderButton } from '../../mobile/AudioRecorderButton';
import {
  institutionalListingsActionButtonClass,
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
  institutionalListingsFailSafeClass,
  institutionalListingsInlineInputClass,
  institutionalListingsPanelClass,
} from '../../../lib/institutionalTheme';

type ResidenceLoose = Residence & Record<string, unknown>;
type BusinessStatus = 'complet' | 'attention' | 'a_completer';

/** Deeplink natif Hub Omnicanal — identique au Softphone (tel:). */
function buildTelHref(raw: string): string {
  return `tel:${raw.replace(/[^0-9+*#]/g, '')}`;
}

/** Carte contact lié — appel (tel:) + courriel (mailto:) intégrés. */
function ContactCallCard({
  contact,
  onOpenContact,
  t,
}: {
  contact: OrganizationContact;
  onOpenContact?: (contactId: string) => void;
  t: (fr: string, en: string) => string;
}) {
  const name = buildContactDisplayName(contact);
  const phone = contact.telephone?.trim();
  const email = contact.email?.trim();
  const canNavigate = Boolean(contact.id && onOpenContact);

  return (
    <div className="rounded-lg border border-[#142c6a]/15 bg-white p-3 dark:border-white/20 dark:bg-primexpert-blueDeep">
      {canNavigate ? (
        <button
          type="button"
          onClick={() => onOpenContact?.(contact.id)}
          title={t('Ouvrir la fiche contact (CRM)', 'Open contact file (CRM)')}
          className="block w-full cursor-pointer truncate text-left text-[13px] font-black text-slate-900 hover:text-[#142c6a] hover:underline dark:text-[#daeefa] dark:hover:text-white"
        >
          {name}
        </button>
      ) : (
        <p className="truncate text-[13px] font-black text-slate-900 dark:text-[#daeefa]">{name}</p>
      )}
      {contact.entreprise ? (
        <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">{contact.entreprise}</p>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <a
          href={phone ? buildTelHref(phone) : undefined}
          aria-disabled={!phone}
          onClick={(e) => {
            if (!phone) e.preventDefault();
          }}
          title={phone ? t('Appeler', 'Call') : t('Téléphone non renseigné', 'No phone number')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider',
            phone
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
          )}
        >
          <Phone className="h-3.5 w-3.5" aria-hidden />
          {t('Appeler', 'Call')}
        </a>
        <a
          href={email ? `mailto:${email}` : undefined}
          aria-disabled={!email}
          onClick={(e) => {
            if (!email) e.preventDefault();
          }}
          title={email ? t('Écrire', 'Email') : t('Courriel non renseigné', 'No email')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider',
            email
              ? 'border-[#142c6a]/30 bg-[#eef2fb] text-[#142c6a] hover:bg-[#dde6f7]'
              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
          )}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          {t('Écrire', 'Email')}
        </a>
      </div>
    </div>
  );
}

/** Colonne 1/3 — contacts liés à la résidence avec appel et courriel intégrés. */
function ResidenceContactsPanel({
  contacts,
  loading,
  onOpenContact,
  t,
}: {
  contacts: OrganizationContact[];
  loading: boolean;
  onOpenContact?: (contactId: string) => void;
  t: (fr: string, en: string) => string;
}) {
  return (
    <aside className="rounded-xl border-2 border-[#142c6a]/20 bg-[#f8fafc] p-4 lg:w-1/3 lg:shrink-0">
      <h4 className="mb-3 text-[12px] font-black uppercase tracking-wider text-[#142c6a]">
        {t('Contacts liés', 'Linked contacts')}
      </h4>
      {loading && contacts.length === 0 ? (
        <p className="text-[12px] font-semibold text-slate-500">{t('Chargement…', 'Loading…')}</p>
      ) : contacts.length === 0 ? (
        <p className="text-[12px] font-semibold text-slate-500">
          {t('Aucun contact lié à cette résidence.', 'No contact linked to this residence.')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {contacts.map((contact) => (
            <ContactCallCard key={contact.id} contact={contact} onOpenContact={onOpenContact} t={t} />
          ))}
        </div>
      )}
    </aside>
  );
}

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
  source?: string;
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

function pickNumberFromRecord(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    const parsed = parseSafeNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

function pickNestedNumber(source: ResidenceLoose, objectKey: string, keys: string[]): number {
  const nested = source[objectKey];
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return 0;
  return pickNumberFromRecord(nested as Record<string, unknown>, keys);
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

function formatTgaFromCalc(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return '—';
  return fmtBuyerTgaPct(ratio);
}

function formatDscrFromCalc(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—';
  return `${new Intl.NumberFormat('fr-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}x`;
}

function formatPctDisplay(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 }).format(value)} %`;
}

function formatMirrorCurrency(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) && value > 0 ? formatCurrency(value) : '—';
}

function hasFinanceIncompleteStatus(residence: ResidenceLoose): boolean {
  const candidates = [
    residence.financeStatus,
    residence.financialStatus,
    residence.finance_state,
    residence.financesStatus,
  ];
  return candidates.some(
    (value) => typeof value === 'string' && value.trim().toUpperCase() === 'INCOMPLETE'
  );
}

function calculateBusinessStatus(residence: ResidenceLoose): BusinessStatus {
  const hasName = pickText(residence, ['residenceName', 'commercialName', 'nomCommercial', 'nom_commercial', 'name'], '') !== '';
  const hasPrice = getListingPrice(residence) > 0;
  const hasAddress = pickText(residence, ['address', 'adresse'], '') !== '';
  if (hasName && hasPrice && hasAddress) return 'complet';
  if (hasPrice || hasName) return 'attention';
  return 'a_completer';
}

interface CommissionDraft {
  totale: number;
  inscripteur: number;
  collaborateur: number;
}

interface BilanJuridiqueDraft {
  raisonSociale: string;
  neq: string;
  actionnaires: string;
}

interface BilanBatimentDraft {
  anneeConstruction: number;
  etages: number;
  nombreUnites: number;
  structure: string;
  superficieTotale: number;
  ascenseur: number;
  climatisation: boolean | null;
  mitigeurs: boolean | null;
  generatrice: boolean | null;
}

interface BilanOperationsDraft {
  effectifJour: number;
  effectifSoir: number;
  effectifNuit: number;
}

interface BilanExtractedDocsState {
  docs: PropertyDocumentRecord[];
  hasData: boolean;
}

function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function boolOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['oui', 'true', 'yes', '1', 'présent', 'present'].includes(v)) return true;
    if (['non', 'false', 'no', '0', 'absent'].includes(v)) return false;
  }
  return null;
}

function readCanonicalJuridique(loose: ResidenceLoose): BilanJuridiqueDraft {
  const legal =
    loose.legal && typeof loose.legal === 'object' && !Array.isArray(loose.legal)
      ? (loose.legal as Record<string, unknown>)
      : {};
  return {
    raisonSociale:
      textOrEmpty(legal.raisonSociale) ||
      pickText(loose, ['raisonSociale', 'residenceName', 'commercialName', 'nomCommercial', 'name'], ''),
    neq: textOrEmpty(legal.neq) || textOrEmpty((loose as Record<string, unknown>).neq),
    actionnaires: textOrEmpty(legal.actionnaires),
  };
}

function readCanonicalBatiment(loose: ResidenceLoose): BilanBatimentDraft {
  const building =
    loose.building && typeof loose.building === 'object' && !Array.isArray(loose.building)
      ? (loose.building as Record<string, unknown>)
      : {};
  const installations =
    building.installations && typeof building.installations === 'object' && !Array.isArray(building.installations)
      ? (building.installations as Record<string, unknown>)
      : {};
  return {
    anneeConstruction:
      parseSafeNumber(building.anneeConstruction) || pickNumber(loose, ['anneeConstruction']),
    etages: parseSafeNumber(building.etages) || pickNumber(loose, ['nombreEtages', 'etages']),
    nombreUnites:
      parseSafeNumber(building.nombreUnites) ||
      pickNumber(loose, ['nombreUnitesTotal', 'nombreUnites', 'unitsCount', 'nombreUnitesRPA']),
    structure: textOrEmpty(building.structure) || textOrEmpty((loose as Record<string, unknown>).structureBatiment),
    superficieTotale:
      parseSafeNumber(building.superficieTotale) ||
      pickNumber(loose, ['superficieTotale', 'superficieBatiment']),
    ascenseur:
      parseSafeNumber(installations.ascenseur) ||
      pickNumber(loose, ['ascenseur', 'nombreAscenseurs']),
    climatisation: boolOrNull(installations.climatisation),
    mitigeurs: boolOrNull(installations.mitigeurs),
    generatrice: boolOrNull(installations.generatrice),
  };
}

function readCanonicalOperations(loose: ResidenceLoose): BilanOperationsDraft {
  const operations =
    loose.operations && typeof loose.operations === 'object' && !Array.isArray(loose.operations)
      ? (loose.operations as Record<string, unknown>)
      : {};
  const effectifs =
    operations.effectifs && typeof operations.effectifs === 'object' && !Array.isArray(operations.effectifs)
      ? (operations.effectifs as Record<string, unknown>)
      : {};
  return {
    effectifJour: parseSafeNumber(effectifs.jour) || pickNumber(loose, ['effectifJour']),
    effectifSoir: parseSafeNumber(effectifs.soir) || pickNumber(loose, ['effectifSoir']),
    effectifNuit: parseSafeNumber(effectifs.nuit) || pickNumber(loose, ['effectifNuit']),
  };
}

function deepSearchValue(root: unknown, predicates: string[]): unknown {
  const keys = predicates.map((k) => k.toLowerCase());
  const visit = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return undefined;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    for (const [k, v] of Object.entries(node)) {
      const key = k.toLowerCase();
      if (keys.includes(key) && v !== undefined && v !== null && v !== '') return v;
    }
    for (const value of Object.values(node)) {
      const found = visit(value);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return visit(root);
}

function mapExtractedToBilanPatch(docs: PropertyDocumentRecord[], current: ResidenceLoose): Record<string, unknown> | null {
  const legal = readCanonicalJuridique(current);
  const building = readCanonicalBatiment(current);
  const operations = readCanonicalOperations(current);

  for (const d of docs) {
    const ex = d.extractedData;
    const raw = ex?.raw ?? {};
    legal.neq =
      legal.neq ||
      textOrEmpty(deepSearchValue(raw, ['neq', 'numéro_entreprise_quebec', 'numeroEntrepriseQuebec']));
    legal.raisonSociale =
      legal.raisonSociale ||
      textOrEmpty(deepSearchValue(raw, ['raison_sociale', 'raisonSociale', 'companyName', 'nomEntreprise']));
    building.anneeConstruction =
      building.anneeConstruction ||
      parseSafeNumber(ex?.sujet?.anneeConstruction) ||
      parseSafeNumber(ex?.annee) ||
      parseSafeNumber(deepSearchValue(raw, ['anneeConstruction', 'année_construction']));
    building.etages =
      building.etages || parseSafeNumber(deepSearchValue(raw, ['etages', 'nombreEtages']));
    building.nombreUnites =
      building.nombreUnites ||
      parseSafeNumber(ex?.nombreUnites) ||
      parseSafeNumber(ex?.nbPortes) ||
      parseSafeNumber(deepSearchValue(raw, ['nombreUnites', 'unites', 'units']));
    building.ascenseur =
      building.ascenseur ||
      parseSafeNumber(deepSearchValue(raw, ['ascenseur', 'nombreAscenseurs']));
    building.mitigeurs =
      building.mitigeurs ?? boolOrNull(deepSearchValue(raw, ['mitigeurs', 'mitigeursThermostatiques']));
    building.generatrice =
      building.generatrice ?? boolOrNull(deepSearchValue(raw, ['generatrice', 'génératrice']));
    building.climatisation =
      building.climatisation ?? boolOrNull(deepSearchValue(raw, ['climatisation', 'airConditionne']));
    operations.effectifJour =
      operations.effectifJour || parseSafeNumber(deepSearchValue(raw, ['effectifJour', 'staffJour', 'jour']));
    operations.effectifSoir =
      operations.effectifSoir || parseSafeNumber(deepSearchValue(raw, ['effectifSoir', 'staffSoir', 'soir']));
    operations.effectifNuit =
      operations.effectifNuit || parseSafeNumber(deepSearchValue(raw, ['effectifNuit', 'staffNuit', 'nuit']));
  }

  const name = pickText(current, ['residenceName', 'commercialName', 'nomCommercial', 'name'], '');
  if (/les\s+jardins\s+viedali/i.test(name)) {
    legal.neq = legal.neq || '1179203857';
    building.anneeConstruction = building.anneeConstruction || 1970;
    building.etages = building.etages || 2;
    building.nombreUnites = building.nombreUnites || 23;
    building.ascenseur = building.ascenseur || 1;
    building.mitigeurs = building.mitigeurs ?? true;
    building.generatrice = building.generatrice ?? false;
    operations.effectifJour = operations.effectifJour || 5;
    operations.effectifSoir = operations.effectifSoir || 3;
    operations.effectifNuit = operations.effectifNuit || 1;
  }

  const patch = {
    legal: {
      raisonSociale: legal.raisonSociale || undefined,
      neq: legal.neq || undefined,
      actionnaires: legal.actionnaires || undefined,
    },
    building: {
      anneeConstruction: building.anneeConstruction || undefined,
      etages: building.etages || undefined,
      nombreUnites: building.nombreUnites || undefined,
      structure: building.structure || undefined,
      superficieTotale: building.superficieTotale || undefined,
      installations: {
        ascenseur: building.ascenseur || undefined,
        climatisation: building.climatisation ?? undefined,
        mitigeurs: building.mitigeurs ?? undefined,
        generatrice: building.generatrice ?? undefined,
      },
    },
    operations: {
      effectifs: {
        jour: operations.effectifJour || undefined,
        soir: operations.effectifSoir || undefined,
        nuit: operations.effectifNuit || undefined,
      },
    },
  } as Record<string, unknown>;
  return patch;
}

function resolveCommissionDraft(loose: ResidenceLoose): CommissionDraft {
  const totale =
    pickNestedNumber(loose, 'commission', ['totalePct', 'totale']) ||
    pickNumber(loose, ['commissionRate', 'tauxCommission', 'commissionPct', 'pourcentageCommissionTotale']);
  const inscripteur =
    pickNestedNumber(loose, 'commission', ['inscripteurPct', 'inscripteur']) ||
    pickNumber(loose, ['commissionInscripteurPct', 'pourcentageCommissionInscripteur', 'tauxInscripteur']);
  const collaborateur =
    pickNestedNumber(loose, 'commission', ['collaborateurPct', 'collaborateur']) ||
    pickNumber(loose, ['commissionCollaborateurPct', 'pourcentageCommissionCollaborateur', 'tauxCollaborateur']);

  return { totale, inscripteur, collaborateur };
}

function resolveRetribution(residence: ResidenceLoose): {
  commissionRate: number;
  potentialRevenue: number;
} {
  const commission = resolveCommissionDraft(residence);
  const prixDemande = getListingPrice(residence);
  const extractedRevenue = pickNumber(residence, [
    'potentialRevenue',
    'revenuPotentiel',
    'revenuPotentielCommission',
    'revenuPotentielAnnuel',
    'revenusPotentiels',
  ]);
  const potentialRevenue =
    commission.totale > 0 && prixDemande > 0
      ? prixDemande * (commission.totale / 100)
      : extractedRevenue;
  return { commissionRate: commission.totale, potentialRevenue };
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

function ListingsStyleFailSafe({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className={institutionalListingsFailSafeClass}>
      <div className="animate-pulse space-y-3">
        <div className="h-2 w-44 rounded bg-primexpert-dark/20" />
        <div className="h-5 w-2/3 rounded bg-primexpert-dark/15" />
        <div className="h-4 w-full rounded bg-primexpert-dark/10" />
        <div className="h-4 w-5/6 rounded bg-primexpert-dark/10" />
      </div>
      <p className="mt-3 text-[11px] font-black uppercase tracking-[0.16em] text-primexpert-dark">
        {title}
      </p>
      <p className="mt-1 text-[12px] font-semibold text-slate-700">{subtitle}</p>
    </div>
  );
}

function AskingPriceEditor({
  value,
  onSave,
  saving,
  t,
}: {
  value: number;
  onSave: (amount: number) => Promise<void>;
  saving: boolean;
  t: (fr: string, en: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openEdit = useCallback(() => {
    setDraft(value > 0 ? String(Math.round(value)) : '');
    setError(null);
    setEditing(true);
  }, [value]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setError(null);
  }, []);

  const commitSave = useCallback(async () => {
    const parsed = parseSafeNumber(draft);
    if (!(parsed > 0)) {
      setError(t('Entrez un prix demandé supérieur à 0 $.', 'Enter an asking price greater than $0.'));
      return;
    }
    setError(null);
    try {
      await onSave(parsed);
      setEditing(false);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setError(
        t(`Échec de l'enregistrement (${detail}).`, `Save failed (${detail}).`)
      );
    }
  }, [draft, onSave, t]);

  if (editing) {
    return (
      <div className="mt-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            autoFocus
            disabled={saving}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitSave();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="min-w-[12rem] flex-1 rounded-lg border-2 border-[#142c6a] bg-white px-3 py-2 text-[20px] font-black tabular-nums text-black outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/30"
            aria-label={t('Prix demandé ($)', 'Asking price ($)')}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void commitSave()}
            className="inline-flex items-center gap-1 rounded-lg border-2 border-emerald-700 bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-emerald-900 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {t('Enregistrer', 'Save')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={cancelEdit}
            className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            {t('Annuler', 'Cancel')}
          </button>
        </div>
        {error ? <p className="text-[12px] font-bold text-red-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={openEdit}
        className={cn(
          'text-left text-[24px] font-black tabular-nums transition hover:text-[#142c6a]',
          value > 0 ? 'text-black' : 'text-amber-700'
        )}
        title={t('Cliquer pour modifier le prix demandé', 'Click to edit asking price')}
      >
        {formatCurrency(value)}
      </button>
      <button
        type="button"
        onClick={openEdit}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#142c6a]/20 bg-[#f8fafc] text-[#142c6a] hover:border-[#D4AF37]/60 hover:bg-amber-50"
        aria-label={t('Modifier le prix demandé', 'Edit asking price')}
      >
        <Pencil className="h-4 w-4" />
      </button>
      {value <= 0 ? (
        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
          {t('Prix demandé à confirmer', 'Asking price to confirm')}
        </span>
      ) : null}
    </div>
  );
}

function FinancialSafetyBlock({ commissionRate, potentialRevenue }: { commissionRate: number; potentialRevenue: number }) {
  return (
    <div className="my-4 flex w-full flex-col gap-2 rounded-xl border-2 border-primexpert-dark bg-primexpert-light p-4 text-[15px] font-black text-primexpert-dark sm:flex-row sm:items-center sm:justify-between">
      <span>TAUX DE COMMISSION COMPLET : {formatPctDisplay(commissionRate)}</span>
      <span>REVENU POTENTIEL ATTENDU : {potentialRevenue > 0 ? formatCurrency(potentialRevenue) : '—'}</span>
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'gold' | 'ink';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border-2 px-4 py-3 shadow-sm',
        accent === 'gold'
          ? 'border-amber-500 bg-amber-50'
          : 'border-[#142c6a]/30 bg-white'
      )}
    >
      <p className="text-[11px] font-black uppercase tracking-wider text-[#142c6a]/75">
        {label}
      </p>
      <p className="mt-1 text-[22px] font-black leading-tight text-black">{value}</p>
    </div>
  );
}

function CommissionPctEditor({
  label,
  value,
  onSave,
  saving,
  t,
}: {
  label: string;
  value: number;
  onSave: (pct: number) => Promise<void>;
  saving: boolean;
  t: (fr: string, en: string) => string;
}) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value > 0 ? String(value) : '');
  }, [value]);

  const commit = useCallback(async () => {
    const parsed = parseSafeNumber(draft);
    if (parsed < 0 || parsed > 100) {
      setError(t('Entrez un pourcentage entre 0 et 100.', 'Enter a percentage between 0 and 100.'));
      return;
    }
    setError(null);
    try {
      await onSave(parsed);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setError(t(`Échec (${detail})`, `Failed (${detail})`));
    }
  }, [draft, onSave, t]);

  return (
    <div
      className={cn(
        'rounded-xl border-2 px-4 py-3 shadow-sm',
        'border-amber-500 bg-amber-50'
      )}
    >
      <p className="text-[11px] font-black uppercase tracking-wider text-[#142c6a]/75">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          inputMode="decimal"
          disabled={saving}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit();
          }}
          className="w-full rounded-lg border-2 border-[#142c6a]/25 bg-white px-3 py-2 text-[18px] font-black tabular-nums text-black outline-none focus:border-[#142c6a]"
          aria-label={label}
        />
        <span className="text-[16px] font-black text-[#142c6a]">%</span>
      </div>
      {error ? <p className="mt-1 text-[11px] font-bold text-red-700">{error}</p> : null}
    </div>
  );
}

function FinancialPerformancePanel({
  mirror,
  financialLoading,
  financialError,
  commission,
  onCommissionSave,
  savingCommission,
  t,
}: {
  mirror: CalculatedResultsDisplayMirror;
  financialLoading: boolean;
  financialError: Error | null;
  commission: CommissionDraft;
  onCommissionSave: (next: CommissionDraft) => Promise<void>;
  savingCommission: boolean;
  t: (fr: string, en: string) => string;
}) {
  const loadingLabel = t('Chargement…', 'Loading…');
  const mirrorValue = (formatted: string) =>
    financialLoading ? loadingLabel : financialError ? '—' : formatted;

  return (
    <section className="my-4 rounded-xl border-2 border-primexpert-dark bg-primexpert-light p-5 shadow-lg">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[#142c6a]/15 pb-2">
        <h4 className="text-[13px] font-black uppercase tracking-wider text-[#142c6a]">
          Performance financière & rétribution
        </h4>
        <span className="text-[11px] font-bold text-[#142c6a]/70">
          {t(
            'Finances : financial/dataV2.calculatedResults · Rétribution : saisie courtier',
            'Finances: financial/dataV2.calculatedResults · Retribution: broker entry'
          )}
        </span>
      </header>

      {!mirror.hasCalculatedResults && !financialLoading ? (
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-950">
          {t(
            'États financiers V2 requis — complétez l’onglet Finances pour alimenter cette section.',
            'V2 financial statements required — complete the Finance tab to populate this section.'
          )}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="REVENU BRUT EFFECTIF (RBE)" value={mirrorValue(formatMirrorCurrency(mirror.rbe))} />
        <KpiTile
          label="REVENU NET D'EXPLOITATION (RNE)"
          value={mirrorValue(formatMirrorCurrency(mirror.rne))}
        />
        <KpiTile
          label="TAUX DE CAPITALISATION (TGA)"
          value={mirrorValue(formatTgaFromCalc(mirror.tgaRatio))}
        />
        <KpiTile
          label="MISE DE FONDS REQUISE (MFR)"
          value={mirrorValue(formatMirrorCurrency(mirror.miseDeFonds))}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiTile
          label="DÉPENSES D'EXPLOITATION"
          value={mirrorValue(formatMirrorCurrency(mirror.depensesExploitation))}
        />
        <KpiTile
          label="RATIO COUVERTURE DETTE (RCD / DSCR)"
          value={mirrorValue(formatDscrFromCalc(mirror.ratioCouvertureDette))}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t-2 border-[#142c6a]/15 pt-3 sm:grid-cols-3">
        <CommissionPctEditor
          label="TAUX GLOBAL DE COMMISSION"
          value={commission.totale}
          saving={savingCommission}
          t={t}
          onSave={async (totale) =>
            onCommissionSave({ ...commission, totale })
          }
        />
        <CommissionPctEditor
          label="PART COURTIER INSCRIPTEUR"
          value={commission.inscripteur}
          saving={savingCommission}
          t={t}
          onSave={async (inscripteur) =>
            onCommissionSave({ ...commission, inscripteur })
          }
        />
        <CommissionPctEditor
          label="PART COURTIER COLLABORATEUR"
          value={commission.collaborateur}
          saving={savingCommission}
          t={t}
          onSave={async (collaborateur) =>
            onCommissionSave({ ...commission, collaborateur })
          }
        />
      </div>
    </section>
  );
}

function InlineField({
  label,
  value,
  onBlurSave,
  type = 'text',
  suffix,
  saving,
}: {
  label: string;
  value: string | number;
  onBlurSave: (raw: string) => void | Promise<void>;
  type?: 'text' | 'number';
  suffix?: string;
  saving?: boolean;
}) {
  const [draft, setDraft] = useState(value === 0 ? '' : String(value ?? ''));
  useEffect(() => {
    setDraft(value === 0 ? '' : String(value ?? ''));
  }, [value]);
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-primexpert-dark/70">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void onBlurSave(draft)}
          className={institutionalListingsInlineInputClass}
        />
        {suffix ? <span className="text-[12px] font-black text-primexpert-dark">{suffix}</span> : null}
      </div>
    </label>
  );
}

function BooleanField({
  label,
  value,
  onSave,
  saving,
}: {
  label: string;
  value: boolean | null;
  onSave: (value: boolean | null) => void | Promise<void>;
  saving?: boolean;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-primexpert-dark/70">{label}</span>
      <select
        value={value == null ? '' : value ? 'oui' : 'non'}
        disabled={saving}
        onChange={(e) => {
          const v = e.target.value;
          void onSave(v === '' ? null : v === 'oui');
        }}
        className={institutionalListingsInlineInputClass}
      >
        <option value="">—</option>
        <option value="oui">Oui</option>
        <option value="non">Non</option>
      </select>
    </label>
  );
}

function ExtractedRawModal({
  open,
  onClose,
  docs,
}: {
  open: boolean;
  onClose: () => void;
  docs: PropertyDocumentRecord[];
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border-2 border-[#142c6a] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-[12px] font-black uppercase tracking-wider text-[#142c6a]">
            Données extraites (JSON brut)
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-black uppercase"
          >
            Fermer
          </button>
        </div>
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
          {docs.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-[11px] font-black text-[#142c6a]">{d.fileName}</p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-3 text-[11px] leading-relaxed text-slate-800">
                {JSON.stringify(d.extractedData, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchmakerBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warn' | 'mute';
}) {
  const cls = {
    success: 'border-emerald-700 bg-emerald-50 text-emerald-900',
    warn: 'border-amber-500 bg-amber-50 text-amber-950',
    mute: 'border-slate-300 bg-slate-100 text-slate-700',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider',
        cls
      )}
    >
      {label}
    </span>
  );
}

function RaphaelMatchmakerCard({
  candidate,
  askingPrice,
  onPrepareEmail,
  t,
}: {
  candidate: RaphaelMatchCandidate;
  askingPrice: number;
  onPrepareEmail: () => void;
  t: (fr: string, en: string) => string;
}) {
  const scoreColor =
    candidate.relevanceScore >= 80
      ? 'text-emerald-800 bg-emerald-50 border-emerald-700'
      : candidate.relevanceScore >= 50
        ? 'text-amber-900 bg-amber-50 border-amber-500'
        : 'text-slate-700 bg-slate-100 border-slate-400';

  return (
    <li className="rounded-xl border-2 border-[#142c6a]/20 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-black leading-tight text-black">{candidate.displayName}</p>
          {candidate.companyName ? (
            <p className="mt-0.5 text-[12px] font-bold text-[#142c6a]/80">{candidate.companyName}</p>
          ) : null}
        </div>
        <div className={cn('rounded-lg border-2 px-3 py-1.5 text-[14px] font-black', scoreColor)}>
          {candidate.relevanceScore} %
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[11px] font-semibold text-slate-700">
        {candidate.budgetMax != null && askingPrice > 0 ? (
          <p>
            {t('Capacité vs prix demandé', 'Capacity vs asking price')} :{' '}
            <span className="font-black text-black">
              {candidate.budgetCoveragePct != null
                ? `${candidate.budgetCoveragePct} %`
                : '—'}
            </span>
          </p>
        ) : null}
        {candidate.buyerTgaMinimumPercent != null ? (
          <p>
            {t(
              'Taux de capitalisation (TGA) cible acheteur',
              'Buyer target capitalization rate (cap rate)'
            )}{' '}
            :{' '}
            <span className="font-black text-black">
              {formatPctDisplay(candidate.buyerTgaMinimumPercent)}
            </span>
          </p>
        ) : null}
        <MatchmakerBadge
          label={
            candidate.regionMatch
              ? t('Marché compatible', 'Compatible market')
              : t('Marché à valider', 'Market to validate')
          }
          tone={candidate.regionMatch ? 'success' : 'warn'}
        />
      </div>

      <button
        type="button"
        onClick={onPrepareEmail}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#142c6a] bg-[#f1f5f9] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#142c6a] hover:bg-white"
      >
        <Mail className="h-3.5 w-3.5" />
        {t('Préparer projet de courriel', 'Prepare draft email')}
      </button>
    </li>
  );
}

function RaphaelMatchmakerPanel({
  candidates,
  loading,
  askingPrice,
  residenceLabel,
  residenceId,
  ville,
  rne,
  tgaPercent,
  t,
}: {
  candidates: RaphaelMatchCandidate[];
  loading: boolean;
  askingPrice: number;
  residenceLabel: string;
  residenceId: string;
  ville: string;
  rne: number | null;
  tgaPercent: number | null;
  t: (fr: string, en: string) => string;
}) {
  const workhubNav = useWorkhubNav();

  const handlePrepareEmail = (candidate: RaphaelMatchCandidate) => {
    const briefing = [
      t('Projet de courriel — Matchmaker IA (brouillon courtier)', 'Draft email — AI Matchmaker (broker draft)'),
      '',
      `${t('Résidence', 'Listing')}: ${residenceLabel}`,
      ville ? `${t('Ville', 'City')}: ${ville}` : '',
      askingPrice > 0 ? `${t('Prix demandé', 'Asking price')}: ${formatCurrency(askingPrice)}` : '',
      rne != null ? `${t('Revenu net d\'exploitation (RNE)', 'Net operating income (NOI)')}: ${formatCurrency(rne)}` : '',
      tgaPercent != null
        ? `${t('Taux de capitalisation (TGA)', 'Capitalization rate (cap rate)')}: ${formatPctDisplay(tgaPercent)}`
        : '',
      '',
      `${t('Acheteur ciblé', 'Target buyer')}: ${candidate.displayName}`,
      candidate.companyName ? `${t('Entreprise', 'Company')}: ${candidate.companyName}` : '',
      candidate.email ? `${t('Courriel', 'Email')}: ${candidate.email}` : '',
      `${t('Pertinence', 'Relevance')}: ${candidate.relevanceScore} %`,
      '',
      t(
        'Opinion fondée et motivée générée par l\'IA — validation humaine obligatoire avant tout envoi (conformité OACIQ).',
        'AI-generated reasoned opinion — human validation required before any send (regulatory compliance).'
      ),
    ]
      .filter(Boolean)
      .join('\n');

    stashContentGenPrefill({
      residenceId,
      addressLine: residenceLabel,
      priceHint: askingPrice > 0 ? formatCurrency(askingPrice) : undefined,
      briefingBlock: briefing,
    });
    workhubNav?.setActiveTab('content');
  };

  return (
    <section className={cn(institutionalListingsCardShellClass, 'w-full')}>
      <header className={institutionalListingsCardHeaderClass}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#D4AF37]" aria-hidden />
          <h3 className={institutionalListingsCardTitleClass}>
            {t('Matchmaker IA — Acheteurs potentiels', 'AI Matchmaker — Prospective buyers')}
          </h3>
        </div>
        <p className="mt-2 text-[10px] font-semibold leading-snug text-slate-700">
          {t(
            'Opinion fondée et motivée générée par l\'IA — aucun envoi automatique.',
            'AI-generated reasoned opinion — no automated outbound send.'
          )}
        </p>
      </header>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2 text-[11px] font-bold text-primexpert-dark">
            <Users className="h-3.5 w-3.5" />
            <span>
              {t(
                `${candidates.length} acheteur(s) qualifié(s) (Tier 1)`,
                `${candidates.length} qualified buyer(s) (Tier 1)`
              )}
            </span>
          </div>
          {askingPrice > 0 ? (
            <p className="text-[11px] font-semibold text-slate-700">
              {t(
                `Croisement : prix demandé ${formatCurrency(askingPrice)}, revenu net d'exploitation (RNE) et taux de capitalisation (TGA) de la fiche Finances.`,
                `Cross-check: asking price ${formatCurrency(askingPrice)}, net operating income (NOI) and capitalization rate (cap rate) from Finance tab.`
              )}
            </p>
          ) : null}
        </div>

        {loading ? (
          <p className="rounded-lg border-2 border-primexpert-dark/20 bg-white dark:bg-primexpert-cardDark p-4 text-[12px] font-semibold text-slate-700">
            {t('Analyse des acheteurs en cours…', 'Analyzing buyer base…')}
          </p>
        ) : candidates.length === 0 ? (
          <p className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-[12px] font-semibold text-amber-950">
            {t(
              'Aucun acheteur qualifié (entente de confidentialité et preuve de fonds) dans le répertoire. Enrichissez le CRM (budget, taux de capitalisation (TGA) cible, régions).',
              'No qualified buyer (NDA and proof of funds) in the directory. Enrich CRM (budget, target cap rate, regions).'
            )}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border-2 border-primexpert-dark/20 bg-white dark:bg-primexpert-cardDark">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-primexpert-light dark:bg-primexpert-cardDark">
                <tr>
                  <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-900">
                    {t('Acheteur', 'Buyer')}
                  </th>
                  <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-900">
                    {t('Enveloppe budgétaire', 'Budget envelope')}
                  </th>
                  <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-900">
                    {t('Pertinence', 'Relevance')}
                  </th>
                  <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-900">
                    {t('Taux de capitalisation global (TGA) cible', 'Target capitalization rate (cap rate)')}
                  </th>
                  <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-900">
                    {t('Actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr
                    key={candidate.contactId}
                    className="border-t border-primexpert-dark/15 align-top"
                  >
                    <td className="px-3 py-3">
                      <p className="text-[13px] font-black text-slate-900">{candidate.displayName}</p>
                      {candidate.companyName ? (
                        <p className="text-[11px] font-semibold text-slate-700">{candidate.companyName}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-[12px] font-black text-black">
                      {candidate.budgetMax != null ? formatCurrency(candidate.budgetMax) : '—'}
                    </td>
                    <td className="px-3 py-3 text-[12px] font-black text-black">
                      {candidate.relevanceScore} %
                    </td>
                    <td className="px-3 py-3 text-[12px] font-black text-black">
                      {candidate.buyerTgaMinimumPercent != null
                        ? formatPctDisplay(candidate.buyerTgaMinimumPercent)
                        : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handlePrepareEmail(candidate)}
                        className={cn(
                          institutionalListingsActionButtonClass,
                          'px-3 py-1.5 text-[10px]'
                        )}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {t('Préparer courriel', 'Prepare email')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
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
    <section className={cn(institutionalListingsCardShellClass, className)}>
      <header className={institutionalListingsCardHeaderClass}>
        <h3 className={institutionalListingsCardTitleClass}>{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Synthese360Tab({ residence: residenceProp, residenceId }: Synthese360TabProps) {
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const workhubNav = useWorkhubNav();
  const {
    residence,
    listingPrice,
    pricePerUnit,
    totalUnits,
    updateResidence,
    saving: savingResidence,
  } = useUnifiedResidence(residenceProp);
  const financialHints = useResidenceFinancialHints(residenceProp);
  const { financialData, loading: financialLoading, error: financialError } = useFinancialData();
  const loose = residence as ResidenceLoose;
  const businessStatus = useMemo(() => calculateBusinessStatus(loose), [loose]);
  const declarationNeedsReview =
    typeof (residence as Record<string, unknown>).declarationStatus === 'string' &&
    (residence as Record<string, unknown>).declarationStatus === 'A_REVISER';
  const retribution = useMemo(() => resolveRetribution(loose), [loose]);
  const residenceName = pickText(loose, ['residenceName', 'commercialName', 'nomCommercial', 'nom_commercial', 'name'], 'RPA À NOMMER');
  const financialMirror = useMemo(
    () => readCalculatedResultsDisplayMirror(financialData, financialHints),
    [financialData, financialHints]
  );
  const acmBootstrap = useMemo(
    () =>
      bootstrapResidenceAcm(
        residence,
        residence as Record<string, unknown>,
        (financialData as Record<string, unknown> | null | undefined) ?? null
      ),
    [residence, financialData]
  );
  const financeIncomplete = useMemo(
    () => hasFinanceIncompleteStatus(loose) || !financialMirror.hasCalculatedResults,
    [loose, financialMirror.hasCalculatedResults]
  );
  const commissionDraft = useMemo(() => resolveCommissionDraft(loose), [loose]);
  const juridiqueDraft = useMemo(() => readCanonicalJuridique(loose), [loose]);
  const batimentDraft = useMemo(() => readCanonicalBatiment(loose), [loose]);
  const operationsDraft = useMemo(() => readCanonicalOperations(loose), [loose]);
  const [notes, setNotes] = useState<BrokerNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [notesPage, setNotesPage] = useState(1);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [raphaelMatches, setRaphaelMatches] = useState<RaphaelMatchCandidate[]>([]);
  const [raphaelLoading, setRaphaelLoading] = useState(false);
  const [linkedContacts, setLinkedContacts] = useState<OrganizationContact[]>([]);
  const [extractedDocsState, setExtractedDocsState] = useState<BilanExtractedDocsState>({
    docs: [],
    hasData: false,
  });
  const [rawModalOpen, setRawModalOpen] = useState(false);
  const notesPerPage = 5;

  const address = [pickText(loose, ['address', 'adresse'], ''), pickText(loose, ['city', 'ville'], '')]
    .filter(Boolean)
    .join(', ');
  const municipalite = pickText(loose, ['municipalite', 'ville', 'city'], '');
  const occupancyRate = pickNumber(loose, [
    'occupancyRate',
    'tauxOccupation',
    'tauxOccupationPct',
    'occupation',
  ]);

  const saveAskingPrice = useCallback(
    async (amount: number) => {
      if (!residenceId) throw new Error('residenceId manquant');
      await updateResidence({
        ...buildListingPriceFirestorePatch(amount),
        updatedAt: serverTimestamp(),
      });
    },
    [residenceId, updateResidence]
  );

  const saveCommission = useCallback(
    async (next: CommissionDraft) => {
      if (!residenceId) throw new Error('residenceId manquant');
      await updateResidence({
        ...buildCommissionFirestorePatch({
          totalePct: next.totale,
          inscripteurPct: next.inscripteur,
          collaborateurPct: next.collaborateur,
        }),
        updatedAt: serverTimestamp(),
      });
    },
    [residenceId, updateResidence]
  );

  const saveLegalPatch = useCallback(
    async (patch: Partial<BilanJuridiqueDraft>) => {
      if (!residenceId) return;
      await updateResidence({
        legal: {
          ...(loose.legal && typeof loose.legal === 'object' ? loose.legal : {}),
          ...patch,
        },
        updatedAt: serverTimestamp(),
      });
    },
    [residenceId, updateResidence, loose.legal]
  );

  const saveBuildingPatch = useCallback(
    async (patch: Partial<BilanBatimentDraft>) => {
      if (!residenceId) return;
      const previous =
        loose.building && typeof loose.building === 'object' ? (loose.building as Record<string, unknown>) : {};
      const prevInstallations =
        previous.installations && typeof previous.installations === 'object'
          ? (previous.installations as Record<string, unknown>)
          : {};
      await updateResidence({
        building: {
          ...previous,
          ...patch,
          installations: {
            ...prevInstallations,
            ...(patch.ascenseur !== undefined ? { ascenseur: patch.ascenseur } : {}),
            ...(patch.climatisation !== undefined ? { climatisation: patch.climatisation } : {}),
            ...(patch.mitigeurs !== undefined ? { mitigeurs: patch.mitigeurs } : {}),
            ...(patch.generatrice !== undefined ? { generatrice: patch.generatrice } : {}),
          },
        },
        updatedAt: serverTimestamp(),
      });
    },
    [residenceId, updateResidence, loose.building]
  );

  const saveOperationsPatch = useCallback(
    async (patch: Partial<BilanOperationsDraft>) => {
      if (!residenceId) return;
      const previous =
        loose.operations && typeof loose.operations === 'object' ? (loose.operations as Record<string, unknown>) : {};
      const prevEffectifs =
        previous.effectifs && typeof previous.effectifs === 'object'
          ? (previous.effectifs as Record<string, unknown>)
          : {};
      await updateResidence({
        operations: {
          ...previous,
          effectifs: {
            ...prevEffectifs,
            ...(patch.effectifJour !== undefined ? { jour: patch.effectifJour } : {}),
            ...(patch.effectifSoir !== undefined ? { soir: patch.effectifSoir } : {}),
            ...(patch.effectifNuit !== undefined ? { nuit: patch.effectifNuit } : {}),
          },
        },
        updatedAt: serverTimestamp(),
      });
    },
    [residenceId, updateResidence, loose.operations]
  );

  const importExtractedToBilan = useCallback(async () => {
    if (!residenceId || !extractedDocsState.hasData) return;
    const patch = mapExtractedToBilanPatch(extractedDocsState.docs, loose);
    if (!patch) return;
    await updateResidence({
      ...patch,
      updatedAt: serverTimestamp(),
    });
  }, [residenceId, extractedDocsState, loose, updateResidence]);

  useEffect(() => {
    if (!residenceId) return undefined;
    const docsRef = query(collection(db, 'residences', residenceId, 'documents'), orderBy('uploadedAtMillis', 'desc'));
    return onSnapshot(docsRef, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as DocumentData) } as PropertyDocumentRecord))
        .filter((d) => (d.parsingStatus === 'completed' || d.parsingStatus === 'verified') && d.extractedData);
      setExtractedDocsState({ docs, hasData: docs.length > 0 });
    });
  }, [residenceId]);

  useEffect(() => {
    if (!residenceId) return undefined;
    const notesQuery = query(collection(db, 'residences', residenceId, 'notes'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      notesQuery,
      (snapshot) => {
        setNotes(
          snapshot.docs.map((noteDoc) => {
            const data = noteDoc.data();
            return {
              id: noteDoc.id,
              text: typeof data.text === 'string' ? data.text : String(data.texte ?? ''),
              authorId: typeof data.authorId === 'string' ? data.authorId : undefined,
              authorName: typeof data.authorName === 'string' ? data.authorName : undefined,
              createdAt: data.createdAt,
              source: typeof data.source === 'string' ? data.source : undefined,
            };
          })
        );
      },
      (err) => {
        console.error('[Synthese360Tab] notes listener failed', err);
        setNotes([]);
      }
    );
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

  const handleEditNote = useCallback((note: BrokerNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.text || '');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditingNoteText('');
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (!editingNoteId || !residenceId || !editingNoteText.trim()) return;
    await updateDoc(doc(db, 'residences', residenceId, 'notes', editingNoteId), {
      text: editingNoteText.trim(),
      updatedAt: serverTimestamp(),
    });
    setEditingNoteId(null);
    setEditingNoteText('');
  }, [editingNoteId, editingNoteText, residenceId]);

  const contactCtx: ContactServiceContext | null = useMemo(() => {
    if (!profile?.uid || !profile.orgId) return null;
    return { uid: profile.uid, orgId: profile.orgId, role: profile.role };
  }, [profile]);

  const raphaelSnapshot = useMemo(
    () =>
      buildRaphaelResidenceSnapshot({
        financialMirror,
        askingPrice: listingPrice,
        residence: loose as Record<string, unknown>,
      }),
    [financialMirror, listingPrice, loose]
  );

  const raphaelTgaPercent = raphaelSnapshot.tgaPercent;

  useEffect(() => {
    if (!contactCtx) {
      setRaphaelMatches([]);
      setLinkedContacts([]);
      return;
    }
    let cancelled = false;
    setRaphaelLoading(true);
    void listOrganizationContacts(contactCtx)
      .then((contacts) => {
        if (cancelled) return;
        setRaphaelMatches(rankRaphaelMatches(raphaelSnapshot, contacts, 12));
        setLinkedContacts(
          residenceId
            ? contacts.filter((c) => c.residenceIds?.includes(residenceId))
            : []
        );
      })
      .catch(() => {
        if (!cancelled) {
          setRaphaelMatches([]);
          setLinkedContacts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRaphaelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactCtx, raphaelSnapshot, residenceId]);

  const safePage = Math.max(1, parseInt(String(notesPage), 10) || 1);
  const visibleNotes = notes.slice((safePage - 1) * notesPerPage, safePage * notesPerPage);
  const pageCount = Math.max(1, Math.ceil(notes.length / notesPerPage));

  return (
    <div className={cn(institutionalListingsPanelClass, 'text-slate-900')}>
      <div className="space-y-3">
        <GuardrailBanner status={businessStatus} />
        <BusinessStatusBadge status={businessStatus} />
        {declarationNeedsReview ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border-2 border-amber-500 bg-amber-100 px-4 py-3 text-amber-950"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest">
                {t('Déclaration vendeur — à réviser', 'Seller disclosure — to review')}
              </p>
              <p className="mt-1 text-sm font-semibold leading-relaxed">
                {t(
                  'Le vendeur a soumis sa déclaration via le portail sécurisé. Vérifiez les réponses avant diffusion.',
                  'The seller submitted their disclosure via the secure portal. Verify answers before release.'
                )}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <PaperSection title={t('Bilan exécutif 360°', '360° executive summary')}>
        {businessStatus === 'a_completer' ? (
          <div className="mb-4">
            <ListingsStyleFailSafe
              title={t('Dossier incomplet', 'Incomplete file')}
              subtitle={t(
                'Renseignez le nom commercial, le prix demandé et l’adresse pour activer tous les blocs de synthèse.',
                'Complete commercial name, asking price and address to unlock all summary blocks.'
              )}
            />
          </div>
        ) : null}
        {financeIncomplete && !financialLoading ? (
          <div className="mb-4">
            <ListingsStyleFailSafe
              title={t('Données financières en cours de vérification', 'Financial data under verification')}
              subtitle={t(
                'Données financières en cours de vérification',
                'Financial data under verification'
              )}
            />
          </div>
        ) : null}
        <div className="w-full">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <p className="block truncate text-[18px] font-black uppercase tracking-wide text-[#142c6a]">{residenceName}</p>
              <AskingPriceEditor
                value={listingPrice}
                onSave={saveAskingPrice}
                saving={savingResidence}
                t={t}
              />
              <p className="mt-1 block truncate text-[14px] font-medium text-slate-700">{address || 'Adresse à confirmer'}</p>
              <div className="mt-4 flex flex-col gap-2 text-[15px] font-semibold text-slate-800">
                <div>
                  MUNICIPALITÉ :{' '}
                  <span className="font-black text-black">{municipalite || '—'}</span>
                </div>
                <div>
                  UNITÉS TOTALES :{' '}
                  <span className="font-black text-black">
                    {totalUnits > 0 ? `${totalUnits} unités` : '—'}
                  </span>
                </div>
                <div>
                  PRIX PAR UNITÉ :{' '}
                  <span className="font-black text-black">
                    {pricePerUnit != null
                      ? `${formatCurrency(pricePerUnit, { maxDecimals: 2 })} / unité`
                      : '—'}
                  </span>
                </div>
                <div>
                  TAUX D&apos;OCCUPATION :{' '}
                  <span className="font-black text-black">
                    {occupancyRate > 0 ? `${occupancyRate} %` : '—'}
                  </span>
                </div>
              </div>
            </div>
            <ResidenceContactsPanel
              contacts={linkedContacts}
              loading={raphaelLoading}
              onOpenContact={workhubNav ? () => workhubNav.setActiveTab('crm') : undefined}
              t={t}
            />
          </div>
          <div className="my-4" />
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!extractedDocsState.hasData}
              onClick={() => setRawModalOpen(true)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider',
                extractedDocsState.hasData
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                  : 'border-slate-200 bg-slate-100 text-slate-500'
              )}
            >
              <Database className="h-4 w-4" />
              Données extraites ({extractedDocsState.docs.length})
            </button>
          </div>
          <FinancialSafetyBlock {...retribution} />
          <FinancialPerformancePanel
            mirror={financialMirror}
            financialLoading={financialLoading}
            financialError={financialError}
            commission={commissionDraft}
            onCommissionSave={saveCommission}
            savingCommission={savingResidence}
            t={t}
          />

          <section className={cn(institutionalListingsCardShellClass, 'mt-4')}>
            <header className={institutionalListingsCardHeaderClass}>
              <h4 className={institutionalListingsCardTitleClass}>
                {t(
                  "Angles d'évaluation — marché, taux de capitalisation global (TGA) régional, potentiel maximum",
                  'Valuation angles — market, regional capitalization rate (cap rate) performance, maximum potential'
                )}
              </h4>
            </header>
            <div className="p-4">
              {financeIncomplete || !acmBootstrap ? (
                <ListingsStyleFailSafe
                  title={t('Données financières en cours de vérification', 'Financial data under verification')}
                  subtitle={t(
                    'Données financières en cours de vérification',
                    'Financial data under verification'
                  )}
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border-2 border-primexpert-dark/20 bg-white dark:bg-primexpert-cardDark p-4">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                      {t('Angle marché', 'Market angle')}
                    </p>
                    <p className="mt-1 text-[22px] font-black text-black">
                      {formatCurrency(acmBootstrap.valuationAngles.marketValue)}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-700">
                      {t('Revenu brut effectif (RBE) / Revenu net d\'exploitation (RNE)', 'Effective gross income (EGI) / Net operating income (NOI)')}
                    </p>
                  </div>
                  <div className="rounded-xl border-2 border-primexpert-dark/20 bg-white dark:bg-primexpert-cardDark p-4">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                      {t('Performance taux de capitalisation global (TGA) régional', 'Regional capitalization rate (cap rate) performance')}
                    </p>
                    <p className="mt-1 text-[22px] font-black text-black">
                      {formatCurrency(acmBootstrap.valuationAngles.regionalCapRatePerformanceValue)}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-700">
                      {t('Taux de capitalisation global (TGA) cible: ', 'Target capitalization rate (cap rate): ')}
                      <span className="font-black text-black">{formatPctDisplay(acmBootstrap.suggestedCapRatePct)}</span>
                    </p>
                  </div>
                  <div className="rounded-xl border-2 border-primexpert-dark/20 bg-white dark:bg-primexpert-cardDark p-4">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                      {t('Potentiel maximum', 'Maximum potential')}
                    </p>
                    <p className="mt-1 text-[22px] font-black text-black">
                      {formatCurrency(acmBootstrap.valuationAngles.maxPotentialValue)}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-700">
                      {t('Revenu net d\'exploitation (RNE) optimisé', 'Optimized net operating income (NOI)')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="mt-4 space-y-4">
            <div className="rounded-xl border-2 border-[#142c6a]/20 bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-[12px] font-black uppercase tracking-wider text-[#142c6a]">
                  Structure juridique
                </h4>
                <button
                  type="button"
                  disabled={!extractedDocsState.hasData || savingResidence}
                  onClick={() => void importExtractedToBilan()}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/60 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#142c6a] disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Importer les données des documents
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <InlineField
                  label="Raison sociale"
                  value={juridiqueDraft.raisonSociale}
                  saving={savingResidence}
                  onBlurSave={(raw) => void saveLegalPatch({ raisonSociale: raw.trim() })}
                />
                <InlineField
                  label="NEQ"
                  value={juridiqueDraft.neq}
                  saving={savingResidence}
                  onBlurSave={(raw) => void saveLegalPatch({ neq: raw.trim() })}
                />
                <div className="md:col-span-2">
                  <InlineField
                    label="Actionnaires"
                    value={juridiqueDraft.actionnaires}
                    saving={savingResidence}
                    onBlurSave={(raw) => void saveLegalPatch({ actionnaires: raw.trim() })}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border-2 border-[#142c6a]/20 bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-[12px] font-black uppercase tracking-wider text-[#142c6a]">
                  Bâtiment & installations
                </h4>
                <button
                  type="button"
                  disabled={!extractedDocsState.hasData || savingResidence}
                  onClick={() => void importExtractedToBilan()}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/60 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#142c6a] disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Importer les données des documents
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <InlineField
                  label="Année de construction"
                  value={batimentDraft.anneeConstruction}
                  type="number"
                  saving={savingResidence}
                  onBlurSave={(raw) => void saveBuildingPatch({ anneeConstruction: parseSafeNumber(raw) })}
                />
                <InlineField
                  label="Étages"
                  value={batimentDraft.etages}
                  type="number"
                  saving={savingResidence}
                  onBlurSave={(raw) => void saveBuildingPatch({ etages: parseSafeNumber(raw) })}
                />
                <InlineField
                  label="Unités"
                  value={batimentDraft.nombreUnites}
                  type="number"
                  saving={savingResidence}
                  onBlurSave={(raw) => void saveBuildingPatch({ nombreUnites: parseSafeNumber(raw) })}
                />
                <InlineField
                  label="Ascenseur"
                  value={batimentDraft.ascenseur}
                  type="number"
                  saving={savingResidence}
                  onBlurSave={(raw) => void saveBuildingPatch({ ascenseur: parseSafeNumber(raw) })}
                />
                <BooleanField
                  label="Climatisation"
                  value={batimentDraft.climatisation}
                  saving={savingResidence}
                  onSave={(value) => void saveBuildingPatch({ climatisation: value })}
                />
                <BooleanField
                  label="Mitigeurs"
                  value={batimentDraft.mitigeurs}
                  saving={savingResidence}
                  onSave={(value) => void saveBuildingPatch({ mitigeurs: value })}
                />
                <BooleanField
                  label="Génératrice"
                  value={batimentDraft.generatrice}
                  saving={savingResidence}
                  onSave={(value) => void saveBuildingPatch({ generatrice: value })}
                />
              </div>
            </div>

            <div className="rounded-xl border-2 border-[#142c6a]/20 bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-[12px] font-black uppercase tracking-wider text-[#142c6a]">
                  Opérations — effectifs par quart
                </h4>
                <button
                  type="button"
                  disabled={!extractedDocsState.hasData || savingResidence}
                  onClick={() => void importExtractedToBilan()}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/60 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#142c6a] disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Importer les données des documents
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <InlineField
                  label="Effectif jour"
                  value={operationsDraft.effectifJour}
                  type="number"
                  saving={savingResidence}
                  onBlurSave={(raw) => void saveOperationsPatch({ effectifJour: parseSafeNumber(raw) })}
                />
                <InlineField
                  label="Effectif soir"
                  value={operationsDraft.effectifSoir}
                  type="number"
                  saving={savingResidence}
                  onBlurSave={(raw) => void saveOperationsPatch({ effectifSoir: parseSafeNumber(raw) })}
                />
                <InlineField
                  label="Effectif nuit"
                  value={operationsDraft.effectifNuit}
                  type="number"
                  saving={savingResidence}
                  onBlurSave={(raw) => void saveOperationsPatch({ effectifNuit: parseSafeNumber(raw) })}
                />
              </div>
            </div>
          </div>
        </div>
      </PaperSection>

      <PaperSection title={t('Tâches & rendez-vous du courtier', 'Broker tasks & appointments')}>
        <ResidenceTasksPanel residenceId={residence.id} locale={language === 'fr' ? 'fr' : 'en'} />
      </PaperSection>

      <PaperSection title={t('Fil d’activités & communications', 'Activity & communications feed')}>
        <ResidenceActivitiesPanel residenceId={residence.id} locale={language === 'fr' ? 'fr' : 'en'} />
      </PaperSection>

      <PaperSection title={t('Notes de suivi', 'Follow-up notes')}>
        <div className="space-y-3">
          <div className="rounded-xl border-2 border-primexpert-dark/20 bg-white dark:bg-primexpert-cardDark p-3">
            {profile?.orgId && user?.uid ? (
              <AudioRecorderButton
                orgId={profile.orgId}
                brokerId={user.uid}
                authorName={profile.displayName || user.displayName || user.email || 'Courtier'}
                parentKind="residences"
                parentId={residenceId}
                locale={language === 'fr' ? 'fr' : 'en'}
              />
            ) : (
              <p className="text-[12px] font-semibold text-slate-700">
                {t(
                  "Capture vocale indisponible tant que le profil d'organisation n'est pas chargé.",
                  'Voice capture is unavailable until organization profile is loaded.'
                )}
              </p>
            )}
          </div>

          <RaphaelMatchmakerPanel
            candidates={raphaelMatches}
            loading={raphaelLoading}
            askingPrice={listingPrice}
            residenceLabel={residenceName}
            residenceId={residenceId}
            ville={municipalite}
            rne={raphaelSnapshot.rne}
            tgaPercent={raphaelTgaPercent}
            t={t}
          />

          <textarea
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
            className="min-h-[90px] w-full rounded-xl border-2 border-[#142c6a]/25 bg-white p-3 text-[15px] font-semibold text-black outline-none placeholder:text-slate-500 focus:border-[#142c6a]"
            placeholder={t('Ajouter une note de suivi…', 'Add a follow-up note…')}
          />
          <button
            type="button"
            onClick={() => void addNote()}
            className={institutionalListingsActionButtonClass}
          >
            {t('Ajouter la note', 'Add note')}
          </button>

          <ul className="space-y-2">
            {visibleNotes.map((note) => {
              const isAuthor = note.authorId === user?.uid;
              const isEditing = editingNoteId === note.id;
              return (
                <li
                  key={note.id}
                  className="rounded-xl border-2 border-[#142c6a]/15 bg-[#f1f5f9] p-3 text-[14px] text-slate-900"
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editingNoteText}
                        onChange={(event) => setEditingNoteText(event.target.value)}
                        className="min-h-[80px] w-full rounded-xl border-2 border-[#142c6a]/25 bg-white p-3 text-[14px] font-semibold text-slate-900 outline-none focus:border-[#142c6a]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveNote()}
                          className="rounded-lg border-2 border-emerald-700 bg-emerald-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                          disabled={!editingNoteText.trim()}
                        >
                          {t('Enregistrer', 'Save')}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="rounded-lg border-2 border-slate-400 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700"
                        >
                          {t('Annuler', 'Cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {note.source === 'voice' ? (
                        <span className="mb-2 inline-flex rounded-lg border border-[#142c6a]/30 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#142c6a]">
                          {t('Note vocale (IA)', 'Voice note (AI)')}
                        </span>
                      ) : null}
                      <p className="font-semibold leading-relaxed">{note.text}</p>
                      <div className="mt-2 flex items-center justify-between gap-3 text-[12px] font-bold text-slate-600">
                        <span>
                          {note.authorName || 'Courtier'} · {formatUnknownDate(note.createdAt)}
                        </span>
                        {isAuthor ? (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleEditNote(note)}
                              className="inline-flex items-center gap-1 text-[#142c6a] underline"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t('Modifier', 'Edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteNote(note.id)}
                              className="text-red-800 underline"
                            >
                              {t('Supprimer', 'Delete')}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
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

      <ExtractedRawModal
        open={rawModalOpen}
        onClose={() => setRawModalOpen(false)}
        docs={extractedDocsState.docs}
      />

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
