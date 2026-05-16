/**
 * Liste les valeurs distinctes de courtier sur `residences` (base V2 nommée).
 * Sert à retrouver l'ancien UID Copilote d'Alain, de Stella, etc.
 *
 * Usage :
 *   node audit_tenant_uids.js
 *   node audit_tenant_uids.js --collection=residences
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DST_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const TENANT_FIELDS = ['courtiersResponsables', 'courtierResponsable', 'brokerId', 'assignedTo'];

const collectionArg = process.argv.find((a) => a.startsWith('--collection='));
const COLLECTION = collectionArg?.slice('--collection='.length) || 'residences';

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').trim());
}

function readOwner(data) {
  for (const field of TENANT_FIELDS) {
    const raw = data[field];
    if (typeof raw === 'string' && raw.trim()) return { field, uid: raw.trim() };
    if (Array.isArray(raw) && raw[0] && typeof raw[0] === 'string') {
      return { field, uid: String(raw[0]).trim(), note: 'array[0]' };
    }
  }
  return { field: '(aucun)', uid: '' };
}

async function main() {
  const dstPath = process.env.DST_SERVICE_ACCOUNT?.trim()
    ? resolve(process.env.DST_SERVICE_ACCOUNT)
    : resolve(__dirname, 'serviceAccountNew.json');
  if (!existsSync(dstPath)) throw new Error(`Fichier introuvable : ${dstPath}`);

  const dstDbId = process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DST_DB;
  const sa = loadJson(dstPath);
  const app = initializeApp({ credential: cert(sa) }, 'audit-tenant');
  const db = dstDbId ? getFirestore(app, dstDbId) : getFirestore(app);

  console.log(`Projet     : ${sa.project_id}`);
  console.log(`Base       : ${dstDbId || '(default)'}`);
  console.log(`Collection : ${COLLECTION}\n`);

  const snap = await db.collection(COLLECTION).get();
  const byUid = new Map();
  let empty = 0;

  for (const doc of snap.docs) {
    const { field, uid } = readOwner(doc.data());
    if (!uid) {
      empty++;
      continue;
    }
    const key = uid;
    const row = byUid.get(key) ?? { count: 0, fields: new Set() };
    row.count++;
    row.fields.add(field);
    byUid.set(key, row);
  }

  console.log(`Documents total : ${snap.size}`);
  console.log(`Sans courtier   : ${empty}\n`);
  console.log('UID distincts (tri par nombre de fiches décroissant) :\n');

  const sorted = [...byUid.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [uid, { count, fields }] of sorted) {
    console.log(`  ${count.toString().padStart(5)} fiches  |  ${uid}`);
    console.log(`           champs : ${[...fields].join(', ')}`);
  }

  if (sorted.length === 0) {
    console.log('  (aucun — vérifier la collection ou la base nommée)');
  }

  console.log('\n--- Utilisateurs V2 (collection users) ---\n');
  try {
    const usersSnap = await db.collection('users').get();
    if (usersSnap.empty) {
      console.log('  Aucun document users/ (profils pas encore créés).');
    } else {
      for (const u of usersSnap.docs) {
        const d = u.data();
        const email = d.email ?? '(sans email)';
        const name = d.displayName ?? '';
        console.log(`  ${u.id}`);
        console.log(`    email: ${email}${name ? `  |  ${name}` : ''}`);
        console.log(`    role: ${d.role ?? '—'}`);
      }
    }
  } catch (e) {
    console.log('  Lecture users/ impossible :', e.message);
  }

  await deleteApp(app);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
