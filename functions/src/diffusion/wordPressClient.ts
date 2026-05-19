/**
 * Client REST WordPress (rpaavendre.com / cpeavendre.com / plexavendre.com).
 *
 * - Auth : Basic Auth via Application Password — jamais hardcodé.
 *   Secrets exposés UNIQUEMENT par `functions.runWith({ secrets: [...] })`.
 * - Timeout : 15 s par défaut (configurable).
 * - Pas de retry interne : le caller orchestre la compensation (le rappel
 *   sera idempotent grâce à `wpPostId` connu côté résidence).
 *
 * Variables d'environnement requises au runtime :
 *   WP_SITE_URL       ex. https://rpaavendre.com
 *   WP_USERNAME       utilisateur applicatif WordPress
 *   WP_APP_PASSWORD   application password (chaîne 24 caractères sans espaces)
 *
 * Optionnel : WP_POST_TYPE (default `posts`).
 */

import { Buffer } from 'node:buffer';

const DEFAULT_TIMEOUT_MS = 15_000;

export type WordPressPostStatus = 'publish' | 'draft' | 'private' | 'pending';

export interface WordPressEndpoint {
  readonly siteUrl: string;
  readonly username: string;
  readonly appPassword: string;
}

export interface WordPressUpsertRequest {
  /** ID du post WP existant (PUT). Absent ⇒ création (POST). */
  wpPostId?: number;
  /** Type de post WP (default `posts`). */
  postType?: string;
  /** Statut WP : publish / draft / private / pending. */
  status: WordPressPostStatus;
  /** Titre marketing public anonymisé. */
  title: string;
  /** Contenu HTML de la fiche publique. */
  content: string;
  /** Slug optionnel — sinon WP en génère un. */
  slug?: string;
  /** Métadonnées ACF / `meta`. */
  meta?: Record<string, string | number | boolean>;
  /** Timeout réseau personnalisé. */
  timeoutMs?: number;
}

export interface WordPressUpsertResponse {
  wpPostId: number;
  wpUrl: string;
  wpStatus: WordPressPostStatus;
}

export interface WordPressStatusUpdateRequest {
  wpPostId: number;
  postType?: string;
  status: WordPressPostStatus;
  timeoutMs?: number;
}

function ensureEndpoint(): WordPressEndpoint {
  const siteUrl = process.env.WP_SITE_URL?.trim();
  const username = process.env.WP_USERNAME?.trim();
  const appPassword = process.env.WP_APP_PASSWORD?.trim();
  if (!siteUrl || !username || !appPassword) {
    throw new Error(
      '[wordPressClient] Secrets manquants — WP_SITE_URL / WP_USERNAME / WP_APP_PASSWORD doivent être configurés.'
    );
  }
  return {
    siteUrl: siteUrl.replace(/\/$/, ''),
    username,
    appPassword,
  };
}

function authHeader(endpoint: WordPressEndpoint): string {
  const token = Buffer.from(
    `${endpoint.username}:${endpoint.appPassword}`,
    'utf-8'
  ).toString('base64');
  return `Basic ${token}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`[wordPressClient] Timeout WP (${timeoutMs} ms) sur ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonOrThrow<T>(response: Response, label: string): Promise<T> {
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `[wordPressClient] ${label} a échoué (HTTP ${response.status}) — ${raw.slice(0, 240)}`
    );
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `[wordPressClient] ${label} : réponse WP non-JSON — ${raw.slice(0, 240)}`
    );
  }
}

/**
 * Crée (POST) ou met à jour (PUT) un post WordPress complet.
 *
 * Pattern idempotent : si `wpPostId` est connu côté Firestore, on PUT, ce qui
 * permet la convergence en cas de retry après échec réseau partiel.
 */
export async function upsertWordPressPost(
  request: WordPressUpsertRequest
): Promise<WordPressUpsertResponse> {
  const endpoint = ensureEndpoint();
  const postType = request.postType || process.env.WP_POST_TYPE || 'posts';
  const isUpdate = typeof request.wpPostId === 'number' && request.wpPostId > 0;
  const url = isUpdate
    ? `${endpoint.siteUrl}/wp-json/wp/v2/${postType}/${request.wpPostId}`
    : `${endpoint.siteUrl}/wp-json/wp/v2/${postType}`;

  const body: Record<string, unknown> = {
    status: request.status,
    title: request.title,
    content: request.content,
  };
  if (request.slug) body.slug = request.slug;
  if (request.meta && Object.keys(request.meta).length > 0) {
    body.meta = request.meta;
  }

  const response = await fetchWithTimeout(
    url,
    {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(endpoint),
      },
      body: JSON.stringify(body),
    },
    request.timeoutMs
  );

  const data = await parseJsonOrThrow<{
    id?: number;
    link?: string;
    status?: string;
  }>(response, request.status === 'draft' ? 'Brouillon WP' : 'Publication WP');

  if (typeof data.id !== 'number') {
    throw new Error('[wordPressClient] Réponse WP invalide — `id` manquant.');
  }

  return {
    wpPostId: data.id,
    wpUrl: typeof data.link === 'string' ? data.link : '',
    wpStatus: (data.status as WordPressPostStatus) ?? request.status,
  };
}

/**
 * Met à jour UNIQUEMENT le statut WP d'un post existant (PUT partiel).
 *
 * Utilisé par `hideListingHandler` pour basculer publish → draft / private
 * sans risquer d'écraser titre, contenu ou métadonnées.
 */
export async function updateWordPressPostStatus(
  request: WordPressStatusUpdateRequest
): Promise<WordPressUpsertResponse> {
  if (!Number.isFinite(request.wpPostId) || request.wpPostId <= 0) {
    throw new Error('[wordPressClient] wpPostId requis pour updateWordPressPostStatus.');
  }
  const endpoint = ensureEndpoint();
  const postType = request.postType || process.env.WP_POST_TYPE || 'posts';
  const url = `${endpoint.siteUrl}/wp-json/wp/v2/${postType}/${request.wpPostId}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(endpoint),
      },
      body: JSON.stringify({ status: request.status }),
    },
    request.timeoutMs
  );

  const data = await parseJsonOrThrow<{
    id?: number;
    link?: string;
    status?: string;
  }>(response, 'Bascule statut WP');

  if (typeof data.id !== 'number') {
    throw new Error('[wordPressClient] Réponse WP invalide — `id` manquant.');
  }

  return {
    wpPostId: data.id,
    wpUrl: typeof data.link === 'string' ? data.link : '',
    wpStatus: (data.status as WordPressPostStatus) ?? request.status,
  };
}
