import type {
  EmailAccountConfig,
  EmailAccountProvider,
  EmailAccountSyncStatus,
} from '../types/emailAccount';

export function createEmailAccountId(): string {
  return `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseProvider(raw: unknown): EmailAccountProvider {
  const v = String(raw ?? '').toLowerCase();
  if (v === 'gmail' || v === 'google') return 'gmail';
  if (v === 'outlook' || v === 'microsoft') return 'outlook';
  return 'imap';
}

function parseSyncStatus(raw: unknown): EmailAccountSyncStatus {
  const v = String(raw ?? '').toLowerCase();
  if (v === 'connected' || v === 'syncing' || v === 'error') return v;
  return 'error';
}

/** Valide et normalise `user.emailAccounts` depuis Firestore. */
export function normalizeEmailAccounts(raw: unknown): EmailAccountConfig[] {
  if (!Array.isArray(raw)) return [];
  const out: EmailAccountConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : '';
    const emailAddress =
      typeof o.emailAddress === 'string' ? o.emailAddress.trim() : '';
    if (!id || !emailAddress) continue;
    const entry: EmailAccountConfig = {
      id,
      emailAddress,
      label:
        typeof o.label === 'string' && o.label.trim()
          ? o.label.trim()
          : emailAddress,
      isDefault: o.isDefault === true,
      syncStatus: parseSyncStatus(o.syncStatus),
      provider: parseProvider(o.provider),
    };
    if (typeof o.nylasGrantId === 'string' && o.nylasGrantId.trim()) {
      entry.nylasGrantId = o.nylasGrantId.trim();
    }
    if (typeof o.connectedAt === 'string' && o.connectedAt.trim()) {
      entry.connectedAt = o.connectedAt.trim();
    }
    out.push(entry);
  }
  return ensureSingleDefault(out);
}

/** Garantit un seul compte `isDefault` (le premier sinon). */
export function ensureSingleDefault(accounts: EmailAccountConfig[]): EmailAccountConfig[] {
  if (!accounts.length) return [];
  const defaultIdx = accounts.findIndex((a) => a.isDefault);
  const idx = defaultIdx >= 0 ? defaultIdx : 0;
  return accounts.map((a, i) => ({ ...a, isDefault: i === idx }));
}

export function resolveDefaultEmailAccount(
  accounts: EmailAccountConfig[]
): EmailAccountConfig | null {
  if (!accounts.length) return null;
  return accounts.find((a) => a.isDefault) ?? accounts[0];
}

/** Compte par défaut à partir du profil (ou repli sur `profile.email`). */
export function resolveEmailAccountsFromProfile(input: {
  emailAccounts?: unknown;
  email?: string;
  displayName?: string;
}): EmailAccountConfig[] {
  const parsed = normalizeEmailAccounts(input.emailAccounts);
  if (parsed.length) return parsed;

  const fallbackEmail = input.email?.trim();
  if (!fallbackEmail) return [];

  return [
    {
      id: 'acc_primary',
      emailAddress: fallbackEmail,
      label: input.displayName?.trim() || 'Boîte principale',
      isDefault: true,
      syncStatus: 'error',
      provider: 'gmail',
    },
  ];
}

export function setDefaultAccount(
  accounts: EmailAccountConfig[],
  accountId: string
): EmailAccountConfig[] {
  return accounts.map((a) => ({ ...a, isDefault: a.id === accountId }));
}

export function providerLabel(
  provider: EmailAccountProvider,
  locale: 'fr' | 'en'
): string {
  const labels: Record<EmailAccountProvider, { fr: string; en: string }> = {
    gmail: { fr: 'Gmail / Google', en: 'Gmail / Google' },
    outlook: { fr: 'Outlook / Microsoft', en: 'Outlook / Microsoft' },
    imap: { fr: 'IMAP personnalisé', en: 'Custom IMAP' },
  };
  return locale === 'fr' ? labels[provider].fr : labels[provider].en;
}

export function syncStatusLabel(
  status: EmailAccountSyncStatus,
  locale: 'fr' | 'en'
): string {
  const labels: Record<EmailAccountSyncStatus, { fr: string; en: string }> = {
    connected: { fr: 'Connecté', en: 'Connected' },
    syncing: { fr: 'Synchronisation…', en: 'Syncing…' },
    error: { fr: 'Non configuré', en: 'Not configured' },
  };
  return locale === 'fr' ? labels[status].fr : labels[status].en;
}
