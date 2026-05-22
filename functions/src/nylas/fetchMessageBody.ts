import { nylasApiBase, requireNylasApiKey } from './config';
import type { NylasMessageObject } from './types';

/** Corps exploitable depuis un objet message Nylas (webhook ou GET). */
export function resolveNylasMessageBody(message: NylasMessageObject): string {
  const body = typeof message.body === 'string' ? message.body.trim() : '';
  if (body.length > 0) return body;
  const snippet = typeof message.snippet === 'string' ? message.snippet.trim() : '';
  return snippet;
}

/** Récupère le message complet via l’API Nylas v3 (corps souvent absent du webhook). */
export async function fetchNylasMessageById(
  grantId: string,
  nylasMessageId: string
): Promise<NylasMessageObject | null> {
  const id = nylasMessageId.trim();
  const grant = grantId.trim();
  if (!id || !grant) return null;

  const apiKey = requireNylasApiKey();
  const url = `${nylasApiBase()}/v3/grants/${encodeURIComponent(grant)}/messages/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    console.warn('[fetchNylasMessageById] failed', res.status, await res.text().catch(() => ''));
    return null;
  }

  const json = (await res.json()) as { data?: NylasMessageObject };
  return json.data ?? null;
}
