/**
 * Priorités tableau de bord — séquence J+3 / J+5 / J+7 (méthode KISS).
 */

import {
  buildPromesseAchatViewModel,
  parsePromesseAchatFromDoc,
  type PromesseCollaborator,
} from '../transaction/promesseAchatEngine';
import {
  RELANCE_J5_TEMPLATE_FR,
  resolveDocumentReleaseBaseline,
  resolveOfferLogged,
  VELOCITY_STEP_A_MAX_DAY,
  VELOCITY_STEP_A_MIN_DAY,
  VELOCITY_STEP_B_DAY,
  VELOCITY_STEP_C_DAY,
  type VelocityCallInput,
  type VelocityMailInput,
} from './transactionVelocity';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/** Fenêtre d'alerte préventive PA : entre 24 h et 48 h avant l'échéance. */
export const PA_ALERT_MIN_HOURS = 24;
export const PA_ALERT_MAX_HOURS = 48;

export type DashboardFollowUpStep =
  | 'j3'
  | 'j4'
  | 'j5'
  | 'j7'
  | 'pa_inspection'
  | 'pa_financement';

export type PaDeadlineKind = 'inspection' | 'financement';

export interface DashboardPriorityFollowUpItem {
  id: string;
  residenceId: string;
  step: DashboardFollowUpStep;
  dueDateMs: number;
  title: string;
  actionText: string;
  buyerFullName: string;
  buyerCompany: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  propertyName: string;
}

export const DASHBOARD_ACTION_J3_FR =
  'Confirmer la réception du dossier documentaire et recenser les questions de l’acheteur.';
export const DASHBOARD_ACTION_J4_FR =
  'Extraire et regrouper les demandes de clarification de l’acheteur (ratios, finances, technique).';
export const DASHBOARD_ACTION_J7_FR =
  'Obtenir une prise de position : offre indicative ou lettre d’intention (LOI).';

const CORPORATE_PATTERN =
  /\b(inc\.?|ltée|ltee|lté|corp\.?|groupe|société|societe|s\.e\.n\.c|senc|llc|ltd\.?|co\.?|cie)\b/i;

function daysSinceRelease(releaseAtMillis: number, now: number): number {
  return Math.floor((now - releaseAtMillis) / MS_PER_DAY);
}

export function dueDateAtBaselinePlusDays(baselineMs: number, days: number): number {
  const d = new Date(baselineMs);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function stepTitleFr(step: DashboardFollowUpStep): string {
  switch (step) {
    case 'j3':
      return '🔔 Suivi envoi documents (J+3)';
    case 'j4':
      return '🔔 Suivi envoi documents (J+4)';
    case 'j5':
      return '🔔 Relance sur les documents (J+5)';
    case 'j7':
      return "🔔 Relance pour une rédaction d'Offre (J+7)";
    case 'pa_inspection':
      return paDeadlineTitleFr('inspection');
    case 'pa_financement':
      return paDeadlineTitleFr('financement');
  }
}

export function paDeadlineLabelFr(kind: PaDeadlineKind): string {
  return kind === 'inspection'
    ? "d'inspection"
    : 'de financement hypothécaire';
}

export function paDeadlineTitleFr(kind: PaDeadlineKind): string {
  return `🔔 Échéance délai ${paDeadlineLabelFr(kind)} PA (dans 48h)`;
}

export function paDeadlineTitleEn(kind: PaDeadlineKind): string {
  return kind === 'inspection'
    ? '🔔 PA inspection deadline (within 48h)'
    : '🔔 PA mortgage financing deadline (within 48h)';
}

export function resolveCollaboratorDisplayName(
  collab: PromesseCollaborator | undefined
): string | null {
  if (!collab) return null;
  const raw = collab as PromesseCollaborator & { name?: string };
  const nom = raw.nom?.trim() || raw.name?.trim();
  return nom || null;
}

export function buildPaDeadlineActionTextFr(
  kind: PaDeadlineKind,
  collaboratorName: string | null
): string {
  const label = paDeadlineLabelFr(kind);
  if (collaboratorName) {
    return `Action : Échéance du délai ${label} dans 48 h. Communiquer avec le courtier collaborateur ${collaboratorName} pour obtenir l'état de la condition.`;
  }
  return `Action : Échéance du délai ${label} dans 48 h. Communiquer avec l'acheteur pour obtenir l'état de la condition.`;
}

export function buildPaDeadlineActionTextEn(
  kind: PaDeadlineKind,
  collaboratorName: string | null
): string {
  const label =
    kind === 'inspection' ? 'inspection' : 'mortgage financing';
  if (collaboratorName) {
    return `Action: ${label} deadline in 48 h. Contact collaborating broker ${collaboratorName} for a status update on this condition.`;
  }
  return `Action: ${label} deadline in 48 h. Contact the buyer for a status update on this condition.`;
}

export function buildPaDeadlineActionText(
  kind: PaDeadlineKind,
  collaboratorName: string | null,
  lang: 'fr' | 'en' = 'fr'
): string {
  return lang === 'fr'
    ? buildPaDeadlineActionTextFr(kind, collaboratorName)
    : buildPaDeadlineActionTextEn(kind, collaboratorName);
}

export function stepActionTextFr(
  step: DashboardFollowUpStep,
  collaboratorName?: string | null
): string {
  switch (step) {
    case 'j3':
      return DASHBOARD_ACTION_J3_FR;
    case 'j4':
      return DASHBOARD_ACTION_J4_FR;
    case 'j5':
      return RELANCE_J5_TEMPLATE_FR;
    case 'j7':
      return DASHBOARD_ACTION_J7_FR;
    case 'pa_inspection':
      return buildPaDeadlineActionTextFr('inspection', collaboratorName ?? null);
    case 'pa_financement':
      return buildPaDeadlineActionTextFr('financement', collaboratorName ?? null);
  }
}

function startOfTodayMs(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Fin de journée civile pour la date limite (échéance inclusive). */
function deadlineIsoToEndMs(iso: string): number {
  return new Date(`${iso}T23:59:59.999`).getTime();
}

/** Heures restantes avant l'échéance (now → fin du jour limite). */
export function hoursUntilPaDeadline(isoDeadline: string, now: number): number {
  const endMs = deadlineIsoToEndMs(isoDeadline);
  const diff = endMs - now;
  return diff / MS_PER_HOUR;
}

/** Alerte préventive : entre 24 h et 48 h avant l'échéance. */
export function isWithinPaAlertWindow(isoDeadline: string, now: number): boolean {
  const hours = hoursUntilPaDeadline(isoDeadline, now);
  return hours >= PA_ALERT_MIN_HOURS && hours <= PA_ALERT_MAX_HOURS;
}

function promesseBlock(doc: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!doc) return null;
  if (doc.promesseAchat && typeof doc.promesseAchat === 'object') {
    return doc.promesseAchat as Record<string, unknown>;
  }
  return null;
}

function isTruthyFlag(...values: unknown[]): boolean {
  return values.some((v) => v === true);
}

export function isInspectionConditionCompleted(
  doc: Record<string, unknown> | null | undefined
): boolean {
  const block = promesseBlock(doc);
  return isTruthyFlag(
    doc?.inspectionRealisee,
    doc?.inspectionComplete,
    doc?.conditionInspectionComplete,
    block?.inspectionRealisee,
    block?.inspectionComplete
  );
}

export function isFinancementConditionCompleted(
  doc: Record<string, unknown> | null | undefined
): boolean {
  const block = promesseBlock(doc);
  return isTruthyFlag(
    doc?.financementRealise,
    doc?.financementComplete,
    doc?.conditionFinancementComplete,
    block?.financementRealise,
    block?.financementComplete
  );
}

function resolveBuyerFromPromesse(
  promesse: ReturnType<typeof parsePromesseAchatFromDoc>,
  doc: Record<string, unknown> | null | undefined,
  mails: VelocityMailInput[],
  sinceMs: number
): {
  fullName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
} {
  if (promesse.buyer?.fullName) {
    return {
      fullName: promesse.buyer.fullName,
      company: promesse.buyer.company ?? null,
      email: promesse.buyer.email ?? null,
      phone: promesse.buyer.phone ?? null,
    };
  }
  return resolveActiveBuyerContact(mails, sinceMs, doc);
}

function pushPaDeadlineAlert(
  items: DashboardPriorityFollowUpItem[],
  input: {
    residenceId: string;
    kind: PaDeadlineKind;
    step: 'pa_inspection' | 'pa_financement';
    isoDeadline: string;
    now: number;
    doc: Record<string, unknown> | null | undefined;
    promesse: ReturnType<typeof parsePromesseAchatFromDoc>;
    mails: VelocityMailInput[];
    address: string;
    city: string;
  }
): void {
  const collaboratorName = resolveCollaboratorDisplayName(
    input.promesse.courtierCollaborateur
  );

  const buyer = resolveBuyerFromPromesse(
    input.promesse,
    input.doc,
    input.mails,
    input.now
  );

  items.push({
    id: `${input.residenceId}-${input.step}`,
    residenceId: input.residenceId,
    step: input.step,
    dueDateMs: startOfTodayMs(input.now),
    title: paDeadlineTitleFr(input.kind),
    actionText: buildPaDeadlineActionTextFr(input.kind, collaboratorName),
    buyerFullName: buyer.fullName,
    buyerCompany: buyer.company,
    buyerEmail: buyer.email,
    buyerPhone: buyer.phone,
    propertyName: resolvePropertyName(input.doc, input.address, input.city),
  });
}

function collectPaDeadlineAlerts(
  r: DashboardPriorityResidenceInput,
  now: number
): DashboardPriorityFollowUpItem[] {
  const promesse = parsePromesseAchatFromDoc(r.doc);
  if (promesse.status !== 'accepted') return [];

  const vm = buildPromesseAchatViewModel(promesse);
  const out: DashboardPriorityFollowUpItem[] = [];

  const inspectionIso = vm.deadlines.dateLimiteInspection;
  if (
    inspectionIso &&
    !isInspectionConditionCompleted(r.doc) &&
    isWithinPaAlertWindow(inspectionIso, now)
  ) {
    pushPaDeadlineAlert(out, {
      residenceId: r.id,
      kind: 'inspection',
      step: 'pa_inspection',
      isoDeadline: inspectionIso,
      now,
      doc: r.doc,
      promesse,
      mails: r.mails,
      address: r.address,
      city: r.city,
    });
  }

  const financementIso = vm.deadlines.dateLimiteFinancement;
  if (
    financementIso &&
    !isFinancementConditionCompleted(r.doc) &&
    isWithinPaAlertWindow(financementIso, now)
  ) {
    pushPaDeadlineAlert(out, {
      residenceId: r.id,
      kind: 'financement',
      step: 'pa_financement',
      isoDeadline: financementIso,
      now,
      doc: r.doc,
      promesse,
      mails: r.mails,
      address: r.address,
      city: r.city,
    });
  }

  return out;
}

function resolveCurrentStep(days: number): DashboardFollowUpStep | null {
  if (days >= VELOCITY_STEP_C_DAY) return 'j7';
  if (days >= VELOCITY_STEP_B_DAY) return 'j5';
  if (days === VELOCITY_STEP_A_MAX_DAY) return 'j4';
  if (days >= VELOCITY_STEP_A_MIN_DAY) return 'j3';
  return null;
}

function stepDayOffset(step: DashboardFollowUpStep): number {
  switch (step) {
    case 'j3':
      return 3;
    case 'j4':
      return 4;
    case 'j5':
      return 5;
    case 'j7':
      return 7;
    case 'pa_inspection':
    case 'pa_financement':
      return 0;
  }
}

function extractCompanyFromName(fullName: string): string | null {
  if (!CORPORATE_PATTERN.test(fullName)) return null;
  return fullName.trim();
}

function splitBuyerNameAndCompany(
  contactName: string | null | undefined,
  doc: Record<string, unknown> | null | undefined
): { fullName: string; company: string | null } {
  const docCompany =
    (typeof doc?.acheteurCompagnie === 'string' && doc.acheteurCompagnie.trim()) ||
    (typeof doc?.buyerCompany === 'string' && doc.buyerCompany.trim()) ||
    (typeof doc?.compagnieAcheteur === 'string' && doc.compagnieAcheteur.trim()) ||
    null;

  const docName =
    (typeof doc?.nomAcheteur === 'string' && doc.nomAcheteur.trim()) ||
    (typeof doc?.acheteurNom === 'string' && doc.acheteurNom.trim()) ||
    (typeof doc?.buyerName === 'string' && doc.buyerName.trim()) ||
    null;

  const raw = contactName?.trim() || docName || 'Acheteur';
  const corpInName = extractCompanyFromName(raw);

  if (docCompany) {
    return {
      fullName: corpInName ? raw.replace(/\s*[([]?[^)]*[)\]]?\s*$/, '').trim() || raw : raw,
      company: docCompany,
    };
  }

  if (corpInName) {
    return { fullName: raw.split(/\s*[-–—]\s*/)[0]?.trim() || raw, company: raw };
  }

  return { fullName: raw, company: null };
}

function resolvePropertyName(
  doc: Record<string, unknown> | null | undefined,
  fallbackAddress: string,
  fallbackCity: string
): string {
  if (typeof doc?.name === 'string' && doc.name.trim()) return doc.name.trim();
  if (fallbackCity?.trim()) return `${fallbackAddress}, ${fallbackCity}`;
  return fallbackAddress;
}

function resolveActiveBuyerContact(
  mails: VelocityMailInput[],
  sinceMs: number,
  doc: Record<string, unknown> | null | undefined
): {
  fullName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
} {
  const buyers = mails
    .filter((m) => m.analyzedAtMillis >= sinceMs)
    .sort((a, b) => b.analyzedAtMillis - a.analyzedAtMillis);

  const lead =
    buyers.find((m) => m.intent === 'buyer') ??
    buyers.find((m) => m.contactEmail?.includes('@')) ??
    buyers[0];

  const { fullName, company } = splitBuyerNameAndCompany(lead?.contactName, doc);

  const docPhone =
    (typeof doc?.telephoneAcheteur === 'string' && doc.telephoneAcheteur.trim()) ||
    (typeof doc?.buyerPhone === 'string' && doc.buyerPhone.trim()) ||
    null;

  const docEmail =
    (typeof doc?.courrielAcheteur === 'string' && doc.courrielAcheteur.trim()) ||
    (typeof doc?.buyerEmail === 'string' && doc.buyerEmail.trim()) ||
    null;

  return {
    fullName,
    company,
    email: lead?.contactEmail?.trim() || docEmail,
    phone: docPhone,
  };
}

export interface DashboardPriorityResidenceInput {
  id: string;
  address: string;
  city: string;
  doc: Record<string, unknown> | null | undefined;
  mails: VelocityMailInput[];
  calls: VelocityCallInput[];
}

export function computeDashboardPriorityFollowUps(
  residences: readonly DashboardPriorityResidenceInput[],
  now = Date.now()
): DashboardPriorityFollowUpItem[] {
  const items: DashboardPriorityFollowUpItem[] = [];

  for (const r of residences) {
    items.push(...collectPaDeadlineAlerts(r, now));

    const baseline = resolveDocumentReleaseBaseline(r.doc);
    if (baseline.releaseAtMillis == null) continue;
    if (resolveOfferLogged(r.doc)) continue;

    const days = daysSinceRelease(baseline.releaseAtMillis, now);
    const step = resolveCurrentStep(days);
    if (!step) continue;

    const buyer = resolveActiveBuyerContact(r.mails, baseline.releaseAtMillis, r.doc);
    const propertyName = resolvePropertyName(r.doc, r.address, r.city);
    const dueDateMs = dueDateAtBaselinePlusDays(baseline.releaseAtMillis, stepDayOffset(step));

    items.push({
      id: `${r.id}-${step}`,
      residenceId: r.id,
      step,
      dueDateMs,
      title: stepTitleFr(step),
      actionText: stepActionTextFr(step),
      buyerFullName: buyer.fullName,
      buyerCompany: buyer.company,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone,
      propertyName,
    });
  }

  return items.sort((a, b) => a.dueDateMs - b.dueDateMs);
}

export function groupPriorityFollowUpsByDueDate(
  items: readonly DashboardPriorityFollowUpItem[],
  locale: string
): { dateKey: string; dateLabel: string; items: DashboardPriorityFollowUpItem[] }[] {
  const map = new Map<string, DashboardPriorityFollowUpItem[]>();

  for (const item of items) {
    const d = new Date(item.dueDateMs);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const bucket = map.get(dateKey) ?? [];
    bucket.push(item);
    map.set(dateKey, bucket);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, groupItems]) => {
      const sample = new Date(groupItems[0].dueDateMs);
      const dateLabel = sample.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return { dateKey, dateLabel, items: groupItems };
    });
}
