/**
 * Rattache un grant Nylas à un compte courriel utilisateur.
 *
 * Usage :
 *   node scripts/attach-nylas-grant.js --grant=a144b6a8-9056-4f37-92b2-2bf112beca04 --email=alain@rpaavendre.com
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEFAULT_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const DEFAULT_UID = 'bYwUG6mxNmPcvK9Xz2Uuy4FxqD83';

const grantArg = process.argv.find((a) => a.startsWith('--grant='));
const emailArg = process.argv.find((a) => a.startsWith('--email='));
const uidArg = process.argv.find((a) => a.startsWith('--uid='));

const grantId = (grantArg?.slice('--grant='.length) || '').trim();
const email = (emailArg?.slice('--email='.length) || 'alain@rpaavendre.com').trim().toLowerCase();
const uid = (uidArg?.slice('--uid='.length) || DEFAULT_UID).trim();

if (!grantId) {
  console.error('Usage: node scripts/attach-nylas-grant.js --grant=NYLAS_GRANT_ID [--email=...] [--uid=...]');
  process.exit(1);
}

const sa = JSON.parse(
  readFileSync(resolve(ROOT, process.env.DST_SERVICE_ACCOUNT?.trim() || 'serviceAccountNew.json'), 'utf8')
);
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app, DEFAULT_DB);

const ref = db.collection('users').doc(uid);
const snap = await ref.get();
if (!snap.exists) {
  console.error('Utilisateur introuvable:', uid);
  process.exit(1);
}

const accounts = Array.isArray(snap.data()?.emailAccounts) ? [...snap.data().emailAccounts] : [];
let found = false;
const next = accounts.map((raw) => {
  if (!raw || typeof raw !== 'object') return raw;
  const acc = { ...raw };
  const addr = typeof acc.emailAddress === 'string' ? acc.emailAddress.toLowerCase() : '';
  if (addr === email) {
    found = true;
    acc.nylasGrantId = grantId;
    acc.syncStatus = 'connected';
    acc.connectedAt = new Date().toISOString();
  }
  return acc;
});

if (!found) {
  console.error(`Compte ${email} introuvable sur users/${uid}`);
  process.exit(1);
}

await ref.update({ emailAccounts: next });
console.log(`✔ nylasGrantId=${grantId} attaché à ${email} (users/${uid})`);

if (getApps().length) await deleteApp(app);
