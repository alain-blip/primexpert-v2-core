/**
 * Grille tarifaire Primexpert — base Solo 150 $/mois équivalent annuel / 175 $ mensuel.
 * MRR = somme (annuel÷12) + somme (mensuel récurrent) + options tél.
 * Cash-in mois = paiements uniques encaissés ce mois + mensualités du mois.
 */

export type PlanId = 'solo' | 'solo_plus' | 'pro' | 'pro_plus' | 'super_pro';

export type BillingCycle = 'annual' | 'monthly';

export interface PlanDefinition {
  id: PlanId;
  labelFr: string;
  labelEn: string;
  /** Capacité Prime-Drive affichée dans la grille tarifaire. */
  storageLabelFr: string;
  storageLabelEn: string;
  /** Paiement unique annuel (CAD). */
  annualLumpCad: number;
  /** Prélèvement mensuel sans engagement (CAD). */
  monthlyRecurringCad: number;
  /** Bordure badge (Tailwind). */
  badgeClass: string;
}

export const PHONE_ADDON = {
  annualLumpCad: 540,
  monthlyRecurringCad: 55,
} as const;

export const PLANS: PlanDefinition[] = [
  {
    id: 'solo',
    labelFr: 'Solo',
    labelEn: 'Solo',
    storageLabelFr: '15 Go de stockage Prime-Drive sécurisé',
    storageLabelEn: '15 GB secure Prime-Drive storage',
    annualLumpCad: 1800,
    monthlyRecurringCad: 175,
    badgeClass: 'border-emerald-400/80 ring-2 ring-emerald-500/30',
  },
  {
    id: 'solo_plus',
    labelFr: 'Solo +',
    labelEn: 'Solo +',
    storageLabelFr: '30 Go de stockage Prime-Drive sécurisé',
    storageLabelEn: '30 GB secure Prime-Drive storage',
    annualLumpCad: 2220,
    monthlyRecurringCad: 215,
    badgeClass: 'border-teal-400/80 ring-2 ring-teal-500/30',
  },
  {
    id: 'pro',
    labelFr: 'Pro',
    labelEn: 'Pro',
    storageLabelFr: '100 Go de stockage Prime-Drive sécurisé (Recommandé)',
    storageLabelEn: '100 GB secure Prime-Drive storage (Recommended)',
    annualLumpCad: 2700,
    monthlyRecurringCad: 260,
    badgeClass: 'border-blue-400/80 ring-2 ring-blue-500/30',
  },
  {
    id: 'pro_plus',
    labelFr: 'Pro +',
    labelEn: 'Pro +',
    storageLabelFr: '250 Go de stockage Prime-Drive sécurisé',
    storageLabelEn: '250 GB secure Prime-Drive storage',
    annualLumpCad: 3120,
    monthlyRecurringCad: 300,
    badgeClass: 'border-indigo-400/80 ring-2 ring-indigo-500/30',
  },
  {
    id: 'super_pro',
    labelFr: 'Super Pro',
    labelEn: 'Super Pro',
    storageLabelFr: '1 To (1000 Go) de stockage Prime-Drive institutionnel',
    storageLabelEn: '1 TB (1000 GB) institutional Prime-Drive storage',
    annualLumpCad: 5400,
    monthlyRecurringCad: 525,
    badgeClass: 'border-amber-400/80 ring-2 ring-amber-500/40',
  },
];

const PLAN_MAP = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, PlanDefinition>;

export function getPlan(id: PlanId): PlanDefinition {
  return PLAN_MAP[id];
}

export type BillingLifecycle = 'trial' | 'paying' | 'at_risk';

export interface Subscriber {
  id: string;
  displayName: string;
  plan: PlanId;
  billingCycle: BillingCycle;
  phoneOption: boolean;
  /** Si annuel : date ISO du dernier paiement unique (pour Cash-in du mois). */
  annualLumpPaidOn?: string;
  /**
   * Affilié Prisma Agence (ou autre) — exempté : MRR payé = 0, Cash-in = 0,
   * valeur cadeau suivie à part (`subscriberGiftValueMrrCad`).
   */
  isAffiliated?: boolean;
  /** Libellé agence partenaire (affichage admin). */
  affiliateAgencyLabel?: string;
  /** Déverrouillage manuel Commercial (hors forfait). */
  manualUnlockCommercial?: boolean;
  /** Déverrouillage multi-logements > 5 unités. */
  manualUnlockMultiOver5?: boolean;
  /** Zones Radar accordées (libellés libres). */
  radarZones?: string[];
  /**
   * Affilié : true = option tél. incluse sans frais (cadeau).
   * false/undefined avec phoneOption = facturée à part si tu appliques une règle métier (démo : offert si true seulement).
   */
  phoneGifted?: boolean;
  /** Début essai 45 jours (yyyy-mm-dd) — Firestore `trialStartDate`. */
  trialStartDate?: string;
  /** Dernier courriel d’onboarding / relance (libellé libre, ex. « J+30 »). */
  lastNurtureEmailSent?: string;
  /** Cycle de facturation côté produit. */
  billingLifecycle?: BillingLifecycle;
  /** Carte / mandat enregistré (J45). */
  hasPaymentMethod?: boolean;
}

export const TRIAL_DAYS_TOTAL = 45;

export function trialDaysRemaining(trialStartIso?: string): number | null {
  if (!trialStartIso) return null;
  const start = new Date(`${trialStartIso}T12:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + TRIAL_DAYS_TOTAL);
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

export function trialEndIsoDate(trialStartIso: string): string {
  const start = new Date(`${trialStartIso}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + TRIAL_DAYS_TOTAL);
  return end.toISOString().slice(0, 10);
}

export function formatTrialEndDate(trialStartIso: string | undefined, locale: 'fr' | 'en'): string {
  if (!trialStartIso) return '—';
  const end = trialEndIsoDate(trialStartIso);
  try {
    return new Date(`${end}T12:00:00`).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      dateStyle: 'medium',
    });
  } catch {
    return end;
  }
}

/** J40+ sans carte : liste « en danger » (simulation). */
export function subscriberInTrialDanger(s: Subscriber): boolean {
  const rem = trialDaysRemaining(s.trialStartDate);
  if (rem === null || rem < 0) return false;
  if (s.billingLifecycle === 'paying') return false;
  if (s.hasPaymentMethod) return false;
  return rem <= 5;
}

/** Données de démo — remplacer par Firestore / Stripe plus tard. */
export const DEMO_SUBSCRIBERS: Subscriber[] = [
  {
    id: '1',
    displayName: 'Claire Dubois',
    plan: 'solo',
    billingCycle: 'annual',
    phoneOption: false,
    annualLumpPaidOn: '2026-05-02',
    billingLifecycle: 'paying',
    hasPaymentMethod: true,
    lastNurtureEmailSent: '—',
  },
  {
    id: '2',
    displayName: 'Martin Gagnon',
    plan: 'solo',
    billingCycle: 'annual',
    phoneOption: false,
    annualLumpPaidOn: '2026-05-08',
    billingLifecycle: 'paying',
    hasPaymentMethod: true,
    lastNurtureEmailSent: '—',
  },
  {
    id: '3',
    displayName: 'Agence Horizon',
    plan: 'solo',
    billingCycle: 'annual',
    phoneOption: false,
    annualLumpPaidOn: '2026-05-12',
    billingLifecycle: 'paying',
    hasPaymentMethod: true,
    lastNurtureEmailSent: '—',
  },
  {
    id: '4',
    displayName: 'Julie Caron',
    plan: 'solo',
    billingCycle: 'monthly',
    phoneOption: false,
    trialStartDate: '2026-04-10',
    billingLifecycle: 'trial',
    hasPaymentMethod: false,
    lastNurtureEmailSent: 'J+21 envoyé',
  },
  {
    id: '5',
    displayName: 'Immo Prestige MTL',
    plan: 'pro',
    billingCycle: 'monthly',
    phoneOption: true,
    billingLifecycle: 'paying',
    hasPaymentMethod: true,
    lastNurtureEmailSent: 'J+7',
  },
  {
    id: '6',
    displayName: 'Capital Résidences',
    plan: 'pro_plus',
    billingCycle: 'annual',
    phoneOption: true,
    annualLumpPaidOn: '2026-04-20',
    billingLifecycle: 'paying',
    hasPaymentMethod: true,
    lastNurtureEmailSent: '—',
  },
  {
    id: '7',
    displayName: 'Réseau St-Laurent',
    plan: 'super_pro',
    billingCycle: 'monthly',
    phoneOption: false,
    billingLifecycle: 'paying',
    hasPaymentMethod: true,
    lastNurtureEmailSent: '—',
  },
  {
    id: '8',
    displayName: 'Sophie Roy',
    plan: 'solo',
    billingCycle: 'monthly',
    phoneOption: false,
    isAffiliated: true,
    affiliateAgencyLabel: 'Prisma Agence Immobilière',
    manualUnlockCommercial: true,
    manualUnlockMultiOver5: false,
    radarZones: ['Centre-Ville', 'Ahuntsic-Cartierville'],
    phoneGifted: true,
    billingLifecycle: 'paying',
    hasPaymentMethod: true,
    lastNurtureEmailSent: '—',
  },
  {
    id: '9',
    displayName: 'Yvon Péladeau',
    plan: 'solo',
    billingCycle: 'monthly',
    phoneOption: false,
    trialStartDate: '2026-04-04',
    billingLifecycle: 'at_risk',
    hasPaymentMethod: false,
    lastNurtureEmailSent: 'J+40 (urgence)',
  },
];

function annualLumpForSubscriber(s: Subscriber): number {
  const p = getPlan(s.plan);
  return p.annualLumpCad + (s.phoneOption ? PHONE_ADDON.annualLumpCad : 0);
}

function monthlyChargeForSubscriber(s: Subscriber): number {
  const p = getPlan(s.plan);
  return p.monthlyRecurringCad + (s.phoneOption ? PHONE_ADDON.monthlyRecurringCad : 0);
}

/** MRR nominal (équivalent tarif catalogue), avant exemption affilié. */
export function subscriberNominalMrrCad(s: Subscriber): number {
  if (s.billingCycle === 'annual') {
    return annualLumpForSubscriber(s) / 12;
  }
  return monthlyChargeForSubscriber(s);
}

/** Part MRR comptée dans les revenus récurrents payants. */
export function subscriberPaidMrrCad(s: Subscriber): number {
  if (s.isAffiliated) return 0;
  return subscriberNominalMrrCad(s);
}

/** Alias historique = MRR payant (hors valeur cadeau affiliés). */
export function subscriberMrrComponentCad(s: Subscriber): number {
  return subscriberPaidMrrCad(s);
}

/** Valeur cadeau mensualisée (affiliés) — pour transparence admin, non ajoutée au MRR payant. */
export function subscriberGiftValueMrrCad(s: Subscriber): number {
  if (!s.isAffiliated) return 0;
  return subscriberNominalMrrCad(s);
}

/** Encaissements réels pour un mois calendaire `yyyy-mm` (affiliés exclus). */
export function cashInForMonthCad(subscribers: Subscriber[], yearMonth: string): number {
  let total = 0;
  for (const s of subscribers) {
    if (s.isAffiliated) continue;
    if (s.billingCycle === 'monthly') {
      total += monthlyChargeForSubscriber(s);
    } else if (s.billingCycle === 'annual' && s.annualLumpPaidOn) {
      const ym = s.annualLumpPaidOn.slice(0, 7);
      if (ym === yearMonth) total += annualLumpForSubscriber(s);
    }
  }
  return total;
}

export function totalMrrCad(subscribers: Subscriber[]): number {
  return subscribers.reduce((acc, s) => acc + subscriberPaidMrrCad(s), 0);
}

export function totalGiftValueMrrCad(subscribers: Subscriber[]): number {
  return subscribers.reduce((acc, s) => acc + subscriberGiftValueMrrCad(s), 0);
}

/** Annual Run Rate (MRR × 12) — vue « annualisée ». */
export function arrFromMrrCad(mrr: number): number {
  return mrr * 12;
}

export function formatCad(n: number, locale: 'fr' | 'en'): string {
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)} $`;
  }
}

/** Contribution au graphique par forfait (lens monthly = part MRR, lens annual = ARR de ce forfait). */
export function revenueByPlan(
  subscribers: Subscriber[],
  lens: 'monthly' | 'annual'
): { plan: PlanId; labelFr: string; labelEn: string; valueCad: number }[] {
  const sums: Record<PlanId, number> = {
    solo: 0,
    solo_plus: 0,
    pro: 0,
    pro_plus: 0,
    super_pro: 0,
  };
  for (const s of subscribers) {
    const m = subscriberPaidMrrCad(s);
    sums[s.plan] += lens === 'monthly' ? m : m * 12;
  }
  return PLANS.filter((p) => sums[p.id] > 0).map((p) => ({
    plan: p.id,
    labelFr: p.labelFr,
    labelEn: p.labelEn,
    valueCad: sums[p.id],
  }));
}
