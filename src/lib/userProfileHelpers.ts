import type { UserProfile } from './auth';

export function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export interface UserContactFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  agency: string;
}

export function userContactFields(profile: UserProfile): UserContactFields {
  const fromName =
    profile.firstName || profile.lastName
      ? { firstName: profile.firstName ?? '', lastName: profile.lastName ?? '' }
      : splitDisplayName(profile.displayName);
  return {
    firstName: fromName.firstName,
    lastName: fromName.lastName,
    email: profile.email,
    phone: profile.phone ?? '—',
    agency: profile.agency ?? '—',
  };
}
