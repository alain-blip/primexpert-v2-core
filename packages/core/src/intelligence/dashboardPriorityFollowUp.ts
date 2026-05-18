/**
 * Priorités tableau de bord — séquence J+3 / J+5 / J+7 (méthode KISS).
 */

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

export type DashboardFollowUpStep = 'j3' | 'j4' | 'j5' | 'j7';

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
  }
}

export function stepActionTextFr(step: DashboardFollowUpStep): string {
  switch (step) {
    case 'j3':
      return DASHBOARD_ACTION_J3_FR;
    case 'j4':
      return DASHBOARD_ACTION_J4_FR;
    case 'j5':
      return RELANCE_J5_TEMPLATE_FR;
    case 'j7':
      return DASHBOARD_ACTION_J7_FR;
  }
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
