/** Statut d'accès facturation — mis à jour par Stripe / Cloud Functions (pas par le client). */
export type BillingStatus = 'active' | 'grace_period' | 'suspended';

/** Jalons courriels automatiques (période d’essai 45 j). */
export type NurtureEmailSent = 'J7' | 'J21' | 'J30' | 'J40';

export const BILLING_STATUS_LABELS = {
  active: { fr: 'Actif', en: 'Active' },
  grace_period: { fr: 'Période de grâce (72 h)', en: 'Grace period (72 h)' },
  suspended: { fr: 'Suspendu', en: 'Suspended' },
} as const;
