import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import * as logger from 'firebase-functions/logger';

function readSignatureHeader(req: Request): string | null {
  const raw =
    req.get('x-nylas-signature') ??
    req.get('X-Nylas-Signature') ??
    req.headers['x-nylas-signature'];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

function readRawBody(req: Request): Buffer | null {
  const extended = req as Request & { rawBody?: Buffer };
  if (extended.rawBody && Buffer.isBuffer(extended.rawBody) && extended.rawBody.length > 0) {
    return extended.rawBody;
  }
  return null;
}

/**
 * Vérifie HMAC-SHA256 (hex) du corps brut — Loi 25 / authenticité Nylas.
 * Le corps doit être exactement celui reçu (gzip inclus si Content-Encoding: gzip).
 */
export function verifyNylasWebhookSignature(req: Request): boolean {
  const secret = process.env.NYLAS_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logger.error('[nylasWebhook] NYLAS_WEBHOOK_SECRET absent — rejet');
    return false;
  }

  const signature = readSignatureHeader(req);
  if (!signature) return false;

  const rawBody = readRawBody(req);
  if (!rawBody) {
    logger.warn('[nylasWebhook] rawBody absent — impossible de valider la signature');
    return false;
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
