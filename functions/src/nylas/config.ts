export function nylasApiBase(): string {
  return (process.env.NYLAS_API_URI || 'https://api.us.nylas.com').replace(/\/$/, '');
}

export function requireNylasApiKey(): string {
  const key = process.env.NYLAS_API_KEY?.trim();
  if (!key) throw new Error('NYLAS_API_KEY manquant (secrets Functions).');
  return key;
}

export function requireNylasClientId(): string {
  const id = process.env.NYLAS_CLIENT_ID?.trim();
  if (!id) throw new Error('NYLAS_CLIENT_ID manquant.');
  return id;
}

export function oauthRedirectUri(): string {
  const explicit = process.env.NYLAS_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const region = process.env.FUNCTION_REGION || 'us-central1';
  return `https://${region}-${project}.cloudfunctions.net/nylasOAuthCallback`;
}

export function appReturnUrl(): string {
  const base =
    process.env.PRIMEXPERT_APP_URL?.trim() || 'https://primexpert-app-v2.web.app';
  const normalized = base.replace(/\/$/, '');
  return normalized.includes('/workhub')
    ? normalized
    : `${normalized}/workhub`;
}
