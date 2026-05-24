import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, Pencil, ShieldCheck, Target, Users } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/auth';
import { useLanguage } from '../../../lib/i18n';
import { cn, formatCurrency } from '../../../lib/utils';
import type { Residence } from '../../../services/residences';
import { ResidenceActivitiesPanel } from '../activities/ResidenceActivitiesPanel';
import { ResidenceTasksPanel } from '../tasks/ResidenceTasksPanel';

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

function readFinancialsRecord(source: ResidenceLoose): Record<string, unknown> | null {
  const raw = source.financials;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
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

interface FinancialPerformance {
  rbe: number;
  rne: number;
  depenses: number;
  rcd: number;
  mfr: number;
  tga: number;
}

const FIN_RBE_KEYS = [
  'revenus_bruts',
  'revenusBruts',
  'revenu_brut_effectif',
  'revenuBrutEffectif',
  'revenusBrutsEffectifs',
  'revenusAnnuelsBruts',
  'revenusLocatifs',
  'revenusAnnuels',
  'totalRevenues',
  'revenusTotal',
  'revenus',
];
const FIN_DEPENSES_KEYS = [
  'depenses_exploitation',
  'depensesExploitation',
  'depenses_totales',
  'depensesTotales',
  'totalDepenses',
  'depensesOperationnelles',
  'depensesOperationnellesTotales',
];
const FIN_RNE_KEYS = [
  'rne_declare_baiia',
  'rneDeclareBaiia',
  'revenu_net_exploitation',
  'revenuNetExploitation',
  'revenuNetOperationnel',
  'noi',
  'profitBrut',
];
const FIN_RCD_KEYS = ['rcd', 'dscr', 'ratioCouvertureDette'];
const FIN_MFR_KEYS = [
  'mfr_equity',
  'mfrEquity',
  'mise_de_fonds_requise',
  'miseDeFondsRequise',
];

function resolveFinancialPerformance(
  loose: ResidenceLoose,
  askingPrice: number
): FinancialPerformance {
  const financials = readFinancialsRecord(loose);

  const pickFin = (keys: string[]): number => {
    if (financials) {
      const fromFin = pickNumberFromRecord(financials, keys);
      if (fromFin > 0) return fromFin;
    }
    return pickNumber(loose, keys);
  };

  const rbe = pickFin(FIN_RBE_KEYS);
  const depenses = pickFin(FIN_DEPENSES_KEYS);
  let rne = pickFin(FIN_RNE_KEYS);
  if (rne <= 0 && rbe > 0 && depenses > 0) {
    rne = Math.max(0, rbe - depenses);
  }
  const rcd = pickFin(FIN_RCD_KEYS);
  const mfr = pickFin(FIN_MFR_KEYS);

  const tga = rne > 0 && askingPrice > 0 ? (rne / askingPrice) * 100 : 0;

  return { rbe, rne, depenses, rcd, mfr, tga };
}

interface CommissionBreakdown {
  totale: number;
  inscripteur: number;
  collaborateur: number;
  source: 'mandat' | 'pa' | 'mixte' | 'fallback' | 'none';
}

function resolveCommissionBreakdown(
  loose: ResidenceLoose,
  fallbackTotale: number
): CommissionBreakdown {
  const purchaseOffer = loose.purchaseOffer;
  const offerRecord =
    purchaseOffer && typeof purchaseOffer === 'object' && !Array.isArray(purchaseOffer)
      ? (purchaseOffer as Record<string, unknown>)
      : null;

  const paTotale = offerRecord
    ? pickNumberFromRecord(offerRecord, [
        'pourcentageRetribution',
        'pourcentageCommissionTotale',
        'commissionTotalePct',
      ])
    : 0;
  const paInscripteur = offerRecord
    ? pickNumberFromRecord(offerRecord, [
        'pourcentageCommissionInscripteur',
        'commissionInscripteurPct',
      ])
    : 0;
  const paCollaborateur = offerRecord
    ? pickNumberFromRecord(offerRecord, [
        'pourcentageCommissionCollaborateur',
        'commissionCollaborateurPct',
      ])
    : 0;

  const mandatTotale =
    pickNumber(loose, [
      'commissionRate',
      'tauxCommission',
      'commissionPct',
      'pourcentageCommissionTotale',
    ]) || pickNestedNumber(loose, 'commission', ['totalePct', 'totale']);
  const mandatInscripteur =
    pickNumber(loose, [
      'commissionInscripteurPct',
      'tauxInscripteur',
      'pourcentageCommissionInscripteur',
    ]) || pickNestedNumber(loose, 'commission', ['inscripteurPct', 'inscripteur']);
  const mandatCollaborateur =
    pickNumber(loose, [
      'commissionCollaborateurPct',
      'tauxCollaborateur',
      'pourcentageCommissionCollaborateur',
    ]) || pickNestedNumber(loose, 'commission', ['collaborateurPct', 'collaborateur']);

  const totale = paTotale > 0 ? paTotale : mandatTotale > 0 ? mandatTotale : fallbackTotale;
  let inscripteur = paInscripteur > 0 ? paInscripteur : mandatInscripteur;
  let collaborateur = paCollaborateur > 0 ? paCollaborateur : mandatCollaborateur;

  if (totale > 0 && inscripteur <= 0 && collaborateur <= 0) {
    const half = totale / 2;
    inscripteur = half;
    collaborateur = half;
  } else if (totale > 0 && inscripteur > 0 && collaborateur <= 0) {
    collaborateur = Math.max(0, totale - inscripteur);
  } else if (totale > 0 && collaborateur > 0 && inscripteur <= 0) {
    inscripteur = Math.max(0, totale - collaborateur);
  }

  const paHas = paTotale > 0 || paInscripteur > 0 || paCollaborateur > 0;
  const mandatHas = mandatTotale > 0 || mandatInscripteur > 0 || mandatCollaborateur > 0;
  let source: CommissionBreakdown['source'] = 'none';
  if (paHas && mandatHas) source = 'mixte';
  else if (paHas) source = 'pa';
  else if (mandatHas) source = 'mandat';
  else if (totale > 0) source = 'fallback';

  return { totale, inscripteur, collaborateur, source };
}

interface MatchmakerCandidate {
  id: string;
  name: string;
  type: string;
  region: string;
  miseDeFondsDisponible: number;
  tgaRecherche: number;
  ndaSigne: boolean;
  preuveFondsApprouvee: boolean;
  score: number;
  ecart: number;
}

const NDA_KEYS = ['ndaSigne', 'nda_signe', 'ententeConfidentialiteSignee', 'confidentialitySigned'];
const POF_KEYS = [
  'preuveFondsApprouvee',
  'preuve_fonds_approuvee',
  'proofOfFundsApproved',
  'proofOfFundsValid',
  'lettreBancaireValide',
];
const REGION_KEYS = [
  'region',
  'regionPreferee',
  'regionAdministrative',
  'regionSociosanitaire',
  'preferredRegion',
];
const MDF_KEYS = ['miseDeFondsDisponible', 'mfrDisponible', 'budgetMax', 'budgetMaxAchat', 'capacite'];
const TGA_KEYS = ['critereTgaMin', 'tgaMinRecherche', 'capRateMin', 'tgaCible'];
const TYPE_KEYS = ['type', 'role', 'profil', 'buyerType'];

function readBoolean(record: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (value === true) return true;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true' || v === 'oui' || v === 'signe' || v === 'signé' || v === 'approuve' || v === 'approuvée' || v === 'approved') {
        return true;
      }
    }
  }
  return false;
}

function getResidenceRegion(loose: ResidenceLoose): string {
  return pickText(
    loose,
    ['regionSociosanitaire', 'region', 'administrativeRegion', 'regionAdministrative'],
    ''
  );
}

function contactInRegion(record: Record<string, unknown>, residenceRegion: string): boolean {
  if (!residenceRegion) return true;
  const target = residenceRegion.toLowerCase();
  for (const key of REGION_KEYS) {
    const value = record[key];
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      if (v && (v.includes(target) || target.includes(v))) return true;
    }
  }
  const zones = record.zonesRecherchees;
  if (Array.isArray(zones)) {
    return zones.some(
      (z) => typeof z === 'string' && z.toLowerCase().includes(target)
    );
  }
  return false;
}

function computeMatchmakerScore(params: {
  regionMatch: boolean;
  mdfCouvreMfr: boolean;
  tgaCompatible: boolean;
  ndaSigne: boolean;
  preuveFondsApprouvee: boolean;
}): number {
  let score = 0;
  if (params.regionMatch) score += 40;
  if (params.mdfCouvreMfr) score += 25;
  if (params.tgaCompatible) score += 15;
  if (params.ndaSigne) score += 10;
  if (params.preuveFondsApprouvee) score += 10;
  return Math.max(0, Math.min(100, score));
}

function buildCandidateName(record: Record<string, unknown>): string {
  const first = typeof record.prenom === 'string' ? record.prenom.trim() : '';
  const last = typeof record.nom === 'string' ? record.nom.trim() : '';
  const composed = [first, last].filter(Boolean).join(' ');
  if (composed) return composed;
  if (typeof record.name === 'string' && record.name.trim()) return record.name.trim();
  if (typeof record.displayName === 'string' && record.displayName.trim()) return record.displayName.trim();
  if (typeof record.email === 'string' && record.email.trim()) return record.email.trim();
  return 'Acheteur inconnu';
}

function resolveCandidate(
  id: string,
  record: Record<string, unknown>,
  residenceRegion: string,
  mfr: number,
  tgaResidence: number
): MatchmakerCandidate {
  const type = (() => {
    for (const key of TYPE_KEYS) {
      const v = record[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return 'Acheteur';
  })();
  const region = (() => {
    for (const key of REGION_KEYS) {
      const v = record[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  })();
  const mdf = pickNumberFromRecord(record, MDF_KEYS);
  const tgaRecherche = pickNumberFromRecord(record, TGA_KEYS);
  const nda = readBoolean(record, NDA_KEYS);
  const pof = readBoolean(record, POF_KEYS);

  const regionMatch = contactInRegion(record, residenceRegion);
  const mdfCouvreMfr = mfr > 0 ? mdf >= mfr : mdf > 0;
  const tgaCompatible = tgaRecherche > 0 && tgaResidence > 0 ? tgaResidence >= tgaRecherche : true;

  const score = computeMatchmakerScore({
    regionMatch,
    mdfCouvreMfr,
    tgaCompatible,
    ndaSigne: nda,
    preuveFondsApprouvee: pof,
  });

  return {
    id,
    name: buildCandidateName(record),
    type,
    region,
    miseDeFondsDisponible: mdf,
    tgaRecherche,
    ndaSigne: nda,
    preuveFondsApprouvee: pof,
    score,
    ecart: mdf - mfr,
  };
}

function isBuyerLike(record: Record<string, unknown>): boolean {
  for (const key of TYPE_KEYS) {
    const v = record[key];
    if (typeof v !== 'string') continue;
    const lower = v.toLowerCase();
    if (
      lower.includes('acheteur') ||
      lower.includes('buyer') ||
      lower.includes('investisseur') ||
      lower.includes('investor')
    ) {
      return true;
    }
  }
  return false;
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

function FinancialPerformancePanel({
  perf,
  commission,
}: {
  perf: FinancialPerformance;
  commission: CommissionBreakdown;
}) {
  const fmtCurrency = (v: number) => (v > 0 ? formatCurrency(v) : '—');
  const fmtMultiple = (v: number) =>
    v > 0
      ? `${new Intl.NumberFormat('fr-CA', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(v)}x`
      : '—';
  const sourceLabel: Record<CommissionBreakdown['source'], string> = {
    pa: 'Source : promesse d’achat (PA)',
    mandat: 'Source : contrat de courtage (mandat)',
    mixte: 'Source : promesse d’achat + mandat',
    fallback: 'Source : taux courtier (répartition estimée 50/50)',
    none: 'Source : à compléter',
  };

  return (
    <section className="my-4 rounded-xl border-2 border-[#142c6a] bg-[#f1f5f9] p-5 shadow-lg">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[#142c6a]/15 pb-2">
        <h4 className="text-[13px] font-black uppercase tracking-wider text-[#142c6a]">
          Performance financière & rétribution
        </h4>
        <span className="text-[11px] font-bold text-[#142c6a]/70">
          {sourceLabel[commission.source]}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="REVENU BRUT EFFECTIF (RBE)" value={fmtCurrency(perf.rbe)} />
        <KpiTile label="REVENU NET D'EXPLOITATION (RNE / NOI)" value={fmtCurrency(perf.rne)} />
        <KpiTile label="TAUX DE CAPITALISATION (TGA)" value={formatPctDisplay(perf.tga)} />
        <KpiTile label="MISE DE FONDS REQUISE (MFR)" value={fmtCurrency(perf.mfr)} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiTile label="DÉPENSES D'EXPLOITATION" value={fmtCurrency(perf.depenses)} />
        <KpiTile label="RATIO COUVERTURE DETTE (RCD / DSCR)" value={fmtMultiple(perf.rcd)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t-2 border-[#142c6a]/15 pt-3 sm:grid-cols-3">
        <KpiTile
          label="TAUX GLOBAL DE COMMISSION"
          value={formatPctDisplay(commission.totale)}
          accent="gold"
        />
        <KpiTile
          label="PART COURTIER INSCRIPTEUR"
          value={formatPctDisplay(commission.inscripteur)}
          accent="gold"
        />
        <KpiTile
          label="PART COURTIER COLLABORATEUR"
          value={formatPctDisplay(commission.collaborateur)}
          accent="gold"
        />
      </div>
    </section>
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

function MatchmakerCard({
  candidate,
  mfr,
}: {
  candidate: MatchmakerCandidate;
  mfr: number;
}) {
  const scoreColor =
    candidate.score >= 80
      ? 'text-emerald-800 bg-emerald-50 border-emerald-700'
      : candidate.score >= 50
      ? 'text-amber-900 bg-amber-50 border-amber-500'
      : 'text-slate-700 bg-slate-100 border-slate-400';
  const ecartLabel =
    mfr > 0
      ? candidate.ecart >= 0
        ? `Surplus de ${formatCurrency(candidate.ecart)} vs MFR`
        : `Manque ${formatCurrency(Math.abs(candidate.ecart))} pour atteindre la MFR`
      : 'Mise de fonds requise (MFR) non chiffrée';
  return (
    <li className="rounded-2xl border-2 border-[#142c6a]/25 bg-white p-5 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#142c6a]/70">
            {candidate.type || 'Acheteur'}
            {candidate.region ? ` · ${candidate.region}` : ''}
          </p>
          <p className="mt-1 text-[22px] font-black leading-tight text-black">{candidate.name}</p>
        </div>
        <div
          className={cn(
            'rounded-xl border-2 px-4 py-2 text-[16px] font-black',
            scoreColor
          )}
        >
          Score : {candidate.score} %
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-[#142c6a]/15 bg-[#f1f5f9] px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#142c6a]/70">
            Mise de fonds disponible
          </p>
          <p className="mt-1 text-[18px] font-black text-black">
            {candidate.miseDeFondsDisponible > 0
              ? formatCurrency(candidate.miseDeFondsDisponible)
              : '—'}
          </p>
        </div>
        <div className="rounded-xl border-2 border-[#142c6a]/15 bg-[#f1f5f9] px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#142c6a]/70">
            Écart vs MFR
          </p>
          <p
            className={cn(
              'mt-1 text-[14px] font-black leading-snug',
              mfr > 0 && candidate.ecart < 0 ? 'text-red-800' : 'text-emerald-900'
            )}
          >
            {ecartLabel}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <MatchmakerBadge
          label={candidate.ndaSigne ? 'NDA : SIGNÉ' : 'NDA : À OBTENIR'}
          tone={candidate.ndaSigne ? 'success' : 'warn'}
        />
        <MatchmakerBadge
          label={
            candidate.preuveFondsApprouvee
              ? 'PREUVE DE FONDS : APPROUVÉE'
              : 'PREUVE DE FONDS : EN ATTENTE'
          }
          tone={candidate.preuveFondsApprouvee ? 'success' : 'warn'}
        />
        {candidate.tgaRecherche > 0 ? (
          <MatchmakerBadge
            label={`TGA recherché : ${new Intl.NumberFormat('fr-CA', {
              maximumFractionDigits: 2,
            }).format(candidate.tgaRecherche)} %`}
            tone="mute"
          />
        ) : null}
      </div>
    </li>
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
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const loose = residence as ResidenceLoose;
  const businessStatus = useMemo(() => calculateBusinessStatus(loose), [loose]);
  const retribution = useMemo(() => resolveRetribution(loose), [loose]);
  const residenceName = pickText(loose, ['residenceName', 'commercialName', 'nomCommercial', 'nom_commercial', 'name'], 'RPA À NOMMER');
  const askingPrice = pickNumber(loose, ['askingPrice', 'prixDemande', 'price', 'prixAnnonce']);
  const financialPerformance = useMemo(
    () => resolveFinancialPerformance(loose, askingPrice),
    [loose, askingPrice]
  );
  const commissionBreakdown = useMemo(
    () => resolveCommissionBreakdown(loose, retribution.commissionRate),
    [loose, retribution.commissionRate]
  );
  const [notes, setNotes] = useState<BrokerNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [notesPage, setNotesPage] = useState(1);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [matchmakerCandidates, setMatchmakerCandidates] = useState<MatchmakerCandidate[]>([]);
  const [matchmakerLoading, setMatchmakerLoading] = useState(false);
  const notesPerPage = 5;

  const address = [pickText(loose, ['address', 'adresse'], ''), pickText(loose, ['city', 'ville'], '')]
    .filter(Boolean)
    .join(', ');
  const municipalite = pickText(loose, ['municipalite', 'ville', 'city'], '');
  const totalUnits = pickNumber(loose, [
    'nombreUnitesTotal',
    'unitsCount',
    'nombreUnites',
    'nombreUnitesRPA',
    'totalUnits',
    'unites',
  ]);
  const occupancyRate = pickNumber(loose, [
    'occupancyRate',
    'tauxOccupation',
    'tauxOccupationPct',
    'occupation',
  ]);
  const prixParPorte = totalUnits > 0 && askingPrice > 0 ? askingPrice / totalUnits : 0;
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

  const residenceRegion = useMemo(() => getResidenceRegion(loose), [loose]);
  const matchmakerMfr = financialPerformance.mfr;
  const matchmakerTga = financialPerformance.tga;

  useEffect(() => {
    if (!user?.uid) {
      setMatchmakerCandidates([]);
      return undefined;
    }
    setMatchmakerLoading(true);
    const ref = collection(db, 'users', user.uid, 'contacts');
    const unsub = onSnapshot(
      ref,
      (snapshot) => {
        const rows: MatchmakerCandidate[] = [];
        snapshot.forEach((contactDoc) => {
          const data = contactDoc.data() as Record<string, unknown>;
          if (!isBuyerLike(data)) return;
          rows.push(
            resolveCandidate(contactDoc.id, data, residenceRegion, matchmakerMfr, matchmakerTga)
          );
        });
        rows.sort((a, b) => b.score - a.score);
        setMatchmakerCandidates(rows);
        setMatchmakerLoading(false);
      },
      () => {
        setMatchmakerCandidates([]);
        setMatchmakerLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid, residenceRegion, matchmakerMfr, matchmakerTga]);

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
          <div className="grid grid-cols-2 gap-4 my-4 text-[15px] text-slate-800 font-semibold border-b border-slate-200 pb-4">
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
                {prixParPorte > 0 ? `${formatCurrency(prixParPorte)} / unité` : '—'}
              </span>
            </div>
            <div>
              TAUX D&apos;OCCUPATION :{' '}
              <span className="font-black text-black">
                {occupancyRate > 0 ? `${occupancyRate} %` : '—'}
              </span>
            </div>
          </div>
          <FinancialSafetyBlock {...retribution} />
          <FinancialPerformancePanel
            perf={financialPerformance}
            commission={commissionBreakdown}
          />
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
          <textarea
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
            className="min-h-[90px] w-full rounded-xl border-2 border-[#142c6a]/25 bg-white p-3 text-[15px] font-semibold text-black outline-none placeholder:text-slate-500 focus:border-[#142c6a]"
            placeholder={t('Ajouter une note de suivi…', 'Add a follow-up note…')}
          />
          <button
            type="button"
            onClick={() => void addNote()}
            className="rounded-lg border-2 border-[#142c6a] bg-[#142c6a] px-4 py-2 text-[12px] font-black uppercase tracking-wider text-white"
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

      <PaperSection title={t('Matchmaker IA — Acheteurs potentiels', 'AI Matchmaker — Prospective buyers')}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#142c6a]/15 pb-3">
            <div className="flex items-center gap-2 text-[12px] font-bold text-[#142c6a]">
              <Target className="h-4 w-4" />
              <span>
                {residenceRegion
                  ? t(
                      `Région ciblée : ${residenceRegion}`,
                      `Targeted region: ${residenceRegion}`
                    )
                  : t(
                      'Région à confirmer sur la fiche pour cibler les acheteurs.',
                      'Region to confirm on the file to target prospective buyers.'
                    )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-bold text-[#142c6a]">
              <Users className="h-4 w-4" />
              <span>
                {t(
                  `${matchmakerCandidates.length} acheteur(s) qualifié(s)`,
                  `${matchmakerCandidates.length} qualified buyer(s)`
                )}
              </span>
            </div>
          </div>

          {matchmakerMfr > 0 ? (
            <p className="text-[13px] font-semibold text-slate-700">
              {t(
                `Mise de fonds requise (MFR) de référence : ${formatCurrency(
                  matchmakerMfr
                )}. Le score combine région, capacité financière, TGA recherché et conformité documentaire.`,
                `Reference required down payment (RFR): ${formatCurrency(
                  matchmakerMfr
                )}. Score combines region, financial capacity, target cap rate and document compliance.`
              )}
            </p>
          ) : (
            <p className="text-[13px] font-semibold text-slate-700">
              {t(
                'Aucune mise de fonds requise (MFR) chiffrée. Le score privilégie la région et la conformité documentaire.',
                'No required down payment (RFR) yet. Score relies on region and document compliance.'
              )}
            </p>
          )}

          {matchmakerLoading ? (
            <p className="rounded-xl border-2 border-[#142c6a]/20 bg-[#f1f5f9] p-4 text-[13px] font-semibold text-slate-700">
              {t('Analyse des acheteurs en cours…', 'Analyzing buyer base…')}
            </p>
          ) : matchmakerCandidates.length === 0 ? (
            <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-[13px] font-semibold text-amber-950">
              {t(
                'Aucun acheteur qualifié dans votre CRM pour cette région. Ajoutez ou enrichissez les fiches contacts (type, région, mise de fonds disponible, conformité documentaire).',
                'No qualified buyer in your CRM for this region. Add or enrich contact records (type, region, available down payment, document compliance).'
              )}
            </p>
          ) : (
            <ul className="space-y-3">
              {matchmakerCandidates.map((candidate) => (
                <MatchmakerCard
                  key={candidate.id}
                  candidate={candidate}
                  mfr={matchmakerMfr}
                />
              ))}
            </ul>
          )}
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
