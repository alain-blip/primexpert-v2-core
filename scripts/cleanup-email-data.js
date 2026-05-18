/**
 * Nettoie les comptes courriel de test (pending.local) et les fils/messages invalides.
 *
 * Cible : users/{uid}.emailAccounts (tableau sur le doc utilisateur)
 *         users/{uid}/email_threads/{threadId}/messages/*
 *
 * Usage :
 *   node scripts/cleanup-email-data.js --dry-run
 *   node scripts/cleanup-email-data.js --uid=bYwUG6mxNmPcvK9Xz2Uuy4FxqD83
 *   node scripts/cleanup-email-data.js --keep=alain@rpaavendre.com
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const DEFAULT_UID = 'bYwUG6mxNmPcvK9Xz2Uuy4FxqD83';
const DEFAULT_KEEP = 'alain@rpaavendre.com';

const dryRun = process.argv.includes('--dry-run');
const uidArg = process.argv.find((a) => a.startsWith('--uid='));
const keepArg = process.argv.find((a) => a.startsWith('--keep='));

const targetUid = (uidArg?.slice('--uid='.length) || process.env.BROKER_UID || DEFAULT_UID).trim();
const keepEmail = (keepArg?.slice('--keep='.length) || DEFAULT_KEEP).trim().toLowerCase();

function loadServiceAccount() {
  const path = resolve(
    ROOT,
    process.env.DST_SERVICE_ACCOUNT?.trim() || 'serviceAccountNew.json'
  );
  return JSON.parse(readFileSync(path, 'utf8').trim());
}

function safeToMillis(raw) {
  try {
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (raw instanceof Timestamp) return raw.toMillis();
    if (typeof raw === 'object' && typeof raw.toMillis === 'function') {
      const ms = raw.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof raw === 'object' && raw.seconds != null) {
      const sec = raw.seconds;
      const nano = raw.nanoseconds ?? raw._nanoseconds ?? 0;
      if (typeof sec === 'number' && Number.isFinite(sec)) {
        return sec * 1000 + Math.floor(nano / 1e6);
      }
    }
    return null;
  } catch {
    return null;
  }
}

function hasInvalidTimestamps(data) {
  const fields = [
    'lastMessageAt',
    'lastMessageAtMillis',
    'createdAt',
    'createdAtMillis',
    'sentAt',
    'sentAtMillis',
  ];
  for (const f of fields) {
    if (!(f in data)) continue;
    const v = data[f];
    if (v === undefined || v === null) continue;
    if (typeof v === 'number' && Number.isFinite(v)) continue;
    if (safeToMillis(v) === null) return true;
  }
  return false;
}

function isPendingLocalEmail(email) {
  return typeof email === 'string' && email.toLowerCase().includes('pending.local');
}

function normalizeAccount(acc) {
  if (!acc || typeof acc !== 'object') return null;
  const email = typeof acc.emailAddress === 'string' ? acc.emailAddress.trim() : '';
  const id = typeof acc.id === 'string' ? acc.id.trim() : '';
  if (!id || !email) return null;
  return { ...acc, id, emailAddress: email };
}

async function deleteThreadTree(db, uid, threadId) {
  const messagesRef = db
    .collection('users')
    .doc(uid)
    .collection('email_threads')
    .doc(threadId)
    .collection('messages');
  const messages = await messagesRef.get();
  let batch = db.batch();
  let n = 0;
  for (const msg of messages.docs) {
    batch.delete(msg.ref);
    n++;
    if (n >= 400) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  }
  if (n > 0) await batch.commit();

  const threadRef = db.collection('users').doc(uid).collection('email_threads').doc(threadId);
  await threadRef.delete();
}

async function main() {
  const dbId = process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DB;
  const app = initializeApp({ credential: cert(loadServiceAccount()) });
  const db = getFirestore(app, dbId);

  console.log(`Projet: primexpert-app-v2 | DB: ${dbId}`);
  console.log(`UID: ${targetUid} | Conserver: ${keepEmail}`);
  console.log(dryRun ? 'MODE: dry-run' : 'MODE: APPLY');

  const userRef = db.collection('users').doc(targetUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    console.error(`Utilisateur introuvable: users/${targetUid}`);
    process.exit(1);
  }

  const data = userSnap.data() || {};
  const accounts = Array.isArray(data.emailAccounts) ? data.emailAccounts : [];
  console.log(`\nemailAccounts actuels (${accounts.length}):`);
  for (const raw of accounts) {
    const a = normalizeAccount(raw);
    console.log(`  - ${a?.emailAddress ?? '?'} (${a?.id ?? '?'}) sync=${a?.syncStatus ?? '?'}`);
  }

  const kept = accounts
    .map(normalizeAccount)
    .filter((a) => a && a.emailAddress.toLowerCase() === keepEmail);

  if (!kept.length) {
    console.warn(
      `\nAucun compte avec ${keepEmail} trouvé. Comptes conservés: 0 (tous pending.local retirés).`
    );
  }

  const keptIds = new Set(kept.map((a) => a.id));
  const nextAccounts = kept.map((a, i) => ({
    ...a,
    isDefault: i === 0,
    syncStatus: a.syncStatus === 'connected' ? 'connected' : a.syncStatus || 'connected',
  }));

  console.log(`\n→ emailAccounts après nettoyage (${nextAccounts.length}):`);
  for (const a of nextAccounts) {
    console.log(`  ✓ ${a.emailAddress} (${a.id})`);
  }

  if (!dryRun) {
    await userRef.update({ emailAccounts: nextAccounts });
    console.log('\n✔ users/{uid}.emailAccounts mis à jour.');
  } else {
    console.log('\n(dry-run) emailAccounts non écrit.');
  }

  const threadsSnap = await userRef.collection('email_threads').get();
  let deleteThreads = 0;
  let keepThreads = 0;

  console.log(`\nemail_threads à analyser: ${threadsSnap.size}`);

  for (const threadDoc of threadsSnap.docs) {
    const t = threadDoc.data();
    const accountId = typeof t.accountId === 'string' ? t.accountId : '';
    const contactEmail = typeof t.contactEmail === 'string' ? t.contactEmail : '';
    const reasons = [];

    if (accountId && keptIds.size > 0 && !keptIds.has(accountId)) {
      reasons.push(`accountId orphelin (${accountId})`);
    }
    if (isPendingLocalEmail(contactEmail)) reasons.push('contact pending.local');
    if (hasInvalidTimestamps(t)) reasons.push('timestamp invalide');

    if (reasons.length) {
      deleteThreads++;
      console.log(`  ✗ DELETE thread ${threadDoc.id}: ${reasons.join('; ')}`);
      if (!dryRun) await deleteThreadTree(db, targetUid, threadDoc.id);
    } else {
      keepThreads++;
    }
  }

  console.log(`\nRésumé fils: ${keepThreads} conservés, ${deleteThreads} supprimés.`);
  if (dryRun) console.log('\nRelancez sans --dry-run pour appliquer.');

  if (getApps().length) await deleteApp(app);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
