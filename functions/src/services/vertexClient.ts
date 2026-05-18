/**
 * Client Vertex AI — identifiants par défaut (ADC) du compte de service Cloud Functions.
 * Sur GCP : pas de GOOGLE_APPLICATION_CREDENTIALS ni clé JSON en prod (metadata server).
 * En local : `gcloud auth application-default login --project=primexpert-app-v2`
 */

import type { VertexAI } from '@google-cloud/vertexai';

const DEFAULT_PROJECT = 'primexpert-app-v2';

/** Région Vertex obligatoire pour les modèles publisher Google (Gemini). */
export const VERTEX_LOCATION = 'us-central1' as const;

/** Modèle publisher actif sur primexpert-app-v2 / us-central1 (vérifié 2026-05-18). */
export const VERTEX_GEMINI_MODEL = 'gemini-2.5-flash' as const;

export function getVertexProject(): string {
  return (
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    DEFAULT_PROJECT
  );
}

export function getVertexLocation(): typeof VERTEX_LOCATION {
  const env = process.env.VERTEX_LOCATION?.trim();
  if (env && env !== VERTEX_LOCATION) {
    console.warn('[vertexClient] VERTEX_LOCATION ignoré pour Gemini publisher', {
      requested: env,
      used: VERTEX_LOCATION,
    });
  }
  return VERTEX_LOCATION;
}

export function getVertexGeminiModel(): string {
  return process.env.VERTEX_GEMINI_MODEL?.trim() || VERTEX_GEMINI_MODEL;
}

let clientPromise: Promise<VertexAI> | null = null;

export async function getVertexClient(): Promise<VertexAI> {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const project = getVertexProject();

    const { VertexAI } = await import('@google-cloud/vertexai');

    // ADC : sur Cloud Run/Functions, identité = serviceAccount de la fonction (metadata server).
    const model = getVertexGeminiModel();

    console.info('[vertexClient] ADC ready', {
      project,
      location: VERTEX_LOCATION,
      endpoint: `projects/${project}/locations/${VERTEX_LOCATION}`,
      model,
    });

    return new VertexAI({
      project,
      location: VERTEX_LOCATION,
    });
  })();

  return clientPromise;
}
