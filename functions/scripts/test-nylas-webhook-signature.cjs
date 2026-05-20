#!/usr/bin/env node
/**
 * Test local — HMAC Nylas (même algo que verifyWebhookSignature.ts).
 * Usage: NYLAS_WEBHOOK_SECRET=test node scripts/test-nylas-webhook-signature.cjs
 */

'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');

const secret = process.env.NYLAS_WEBHOOK_SECRET || 'primexpert_test_secret';
const body = Buffer.from(
  JSON.stringify({ type: 'message.created', data: { object: { id: 'msg_1' } } }),
  'utf8'
);
const expected = createHmac('sha256', secret).update(body).digest('hex');

function verify(rawBody, signature, webhookSecret) {
  const exp = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(exp, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

const ok = verify(body, expected, secret);
const bad = verify(body, 'deadbeef', secret);

if (!ok || bad) {
  console.error('[test-nylas-webhook-signature] ÉCHEC', { ok, bad });
  process.exit(1);
}
console.log('[test-nylas-webhook-signature] OK — signature valide, rejet invalide');
