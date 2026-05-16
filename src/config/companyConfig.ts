/**
 * Données légales Primexpert — une seule source pour factures PDF.
 * Remplacer les espaces réservés le jour J de l'incorporation.
 */
export const COMPANY_CONFIG = {
  name: 'Primexpert Inc. [EN ATTENTE]',
  neq: '[NEQ EN ATTENTE]',
  tpsNumber: '[NUMÉRO TPS EN ATTENTE]',
  tvqNumber: '[NUMÉRO TVQ EN ATTENTE]',
  email: 'comptabilite@primexpert.ca',
  /** Responsable support — alertes sondage J7 (options B/C). */
  supportEmail:
    (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || 'support@primexpert.ca',
  address: '[ADRESSE EN ATTENTE], Québec, Canada',
} as const;

/** Portail client Stripe — à définir dans `.env` : VITE_STRIPE_CUSTOMER_PORTAL_URL */
export const STRIPE_CUSTOMER_PORTAL_URL =
  (import.meta.env.VITE_STRIPE_CUSTOMER_PORTAL_URL as string | undefined)?.trim() || '';
