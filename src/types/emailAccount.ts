/** Comptes courriel synchronisés rattachés au profil courtier. */

export type EmailAccountProvider = 'gmail' | 'outlook' | 'imap';

export type EmailAccountSyncStatus = 'connected' | 'error' | 'syncing';

/** Alias canonique brief multi-boîtes. */
export type EmailAccount = EmailAccountConfig;

export interface EmailAccountConfig {
  /** ID unique du compte (ex. `acc_1`, `acc_2`). */
  id: string;
  /** Adresse courriel (ex. `alain@primexpert.ca`). */
  emailAddress: string;
  /** Libellé affiché (ex. Direction, Prospection RPA). */
  label: string;
  /** Boîte principale par défaut. */
  isDefault: boolean;
  syncStatus: EmailAccountSyncStatus;
  /** Fournisseur — connexion via Nylas (Gmail / Microsoft). */
  provider: EmailAccountProvider;
  /** Grant Nylas (OAuth) — jamais exposé côté client UI. */
  nylasGrantId?: string;
  /** ISO — date de connexion OAuth réussie. */
  connectedAt?: string;
}
