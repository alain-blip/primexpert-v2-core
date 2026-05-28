/** URL de base des Cloud Functions HTTP (primexpert-app-v2). */
export function getFunctionsBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_FUNCTIONS_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION?.trim() || 'us-central1';
  const projectId =
    import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || 'primexpert-app-v2';
  return `https://${region}-${projectId}.cloudfunctions.net`;
}
