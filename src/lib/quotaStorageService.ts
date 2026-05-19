import type { DriveDocument } from '../services/driveStorage';

export type StorageTier = 'solo' | 'solo_plus' | 'pro' | 'pro_plus' | 'super_pro';

export const STORAGE_TIER_LIMITS_BYTES: Record<StorageTier, number> = {
  solo: 15 * 1024 * 1024 * 1024,
  solo_plus: 30 * 1024 * 1024 * 1024,
  pro: 100 * 1024 * 1024 * 1024,
  pro_plus: 250 * 1024 * 1024 * 1024,
  super_pro: 1000 * 1024 * 1024 * 1024,
};

export const STORAGE_TIER_LABELS: Record<StorageTier, string> = {
  solo: 'Solo',
  solo_plus: 'Solo Plus',
  pro: 'Pro',
  pro_plus: 'Pro Plus',
  super_pro: 'Super Pro',
};

const TIER_ORDER: StorageTier[] = ['solo', 'solo_plus', 'pro', 'pro_plus', 'super_pro'];

export function resolveStorageTier(raw?: string | null): StorageTier {
  if (
    raw === 'solo' ||
    raw === 'solo_plus' ||
    raw === 'pro' ||
    raw === 'pro_plus' ||
    raw === 'super_pro'
  ) {
    return raw;
  }
  return 'pro';
}

export function nextStorageTier(tier: StorageTier): StorageTier | null {
  const index = TIER_ORDER.indexOf(tier);
  return index >= 0 && index < TIER_ORDER.length - 1 ? TIER_ORDER[index + 1] : null;
}

export function bytesUsedByDriveDocuments(docs: DriveDocument[]): number {
  return docs.reduce((sum, d) => sum + (d.type === 'folder' ? 0 : d.size || 0), 0);
}

export function formatStorageBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} Go`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} Mo`;
}

export function buildStorageQuotaLabel(usedBytes: number, tier: StorageTier): string {
  const limit = STORAGE_TIER_LIMITS_BYTES[tier];
  return `Espace disque : ${formatStorageBytes(usedBytes)} / ${formatStorageBytes(limit)} (Forfait ${STORAGE_TIER_LABELS[tier]})`;
}

export function wouldExceedStorageQuota(
  usedBytes: number,
  incomingBytes: number,
  tier: StorageTier
): boolean {
  return usedBytes + incomingBytes > STORAGE_TIER_LIMITS_BYTES[tier];
}
